# 02 — Module Communication Patterns

## 1. Ringkasan Pola Komunikasi

| Flow | Pola | Alasan |
|---|---|---|
| PMS ↔ CMS (availability/rate) | Event-Driven async | OTA lambat/retriable, jangan blokir PMS |
| CMS ← OTA (inbound booking) | Webhook → Event | Anti-corruption layer, deduplicate |
| PMS ↔ POS (RTR lookup) | Sync direct call | Kasir butuh jawaban langsung |
| POS → PMS (folio write) | Event-Driven async | Decouple setelah lookup |
| PMS/POS → Accounting | Event-Driven async | Accounting = pure subscriber |
| Inventory → Accounting | Event-Driven async | DR Inventory / CR AP on receive |
| Night Audit → semua modul | Orchestrated sequence | NightAuditService koordinasi semua |

---

## 2. PMS ↔ Alava Channel Manager (Tahap 1)

```
[Alava PMS] Reservasi dibuat / kamar diblokir / check-in/out
        │
        ▼  publishes
RoomInventoryUpdatedEvent { hotelId, roomTypeId, date, delta }
        │
        ▼  subscribes
[CMS EventHandler]
        ├─► Update tabel availability_blocks (local)
        └─► Enqueue BullMQ job → push ke OTA aktif
              (retry 5x dengan exponential backoff jika OTA API down)

[OTA] Booking masuk via Webhook
        │
        ▼
[CMS WebhookController]
        ├─► Check Redis idempotency key: cms:webhook:{ota}:{booking_ref}
        │   Jika sudah ada: ignore (duplicate)
        │
        ▼  publishes
OTABookingReceivedEvent { source, otaRef, guestData, roomData, dates }
        │
        ▼  subscribes
[PMS EventHandler]
        └─► Buat Reservation + Folio → kurangi availability_blocks
```

**Redis keys untuk CMS:**
```
availability:{hid}:{room_type_id}:{date}  TTL: 15 menit
rate:{hid}:{rate_plan_id}:{date}          TTL: 30 menit
cms:webhook:{ota}:{booking_ref}           TTL: 24 jam (idempotency)
```

---

## 3. PMS ↔ Alava POS — Route-to-Room (RTR)

```
[Kasir POS] Tamu minta charge ke kamar {room_number}
        │
        ▼  sync call
PmsService.getActiveFolio(hotelId, roomNumber)
        │
        ├─► Cek Redis: folio:active:{hid}:{room_no}
        │     HIT  → return { folioId, guestName, creditLimit, balance }
        │     MISS → query PostgreSQL → populate Redis → return
        │
        ▼
[POS] Validasi credit limit
      Create POSTransaction (status: POSTED_TO_ROOM)
        │
        ▼  publishes
POSChargePostedToRoomEvent { folioId, transactionId, amount, outletName }
        │
        ▼  subscribes
[PMS EventHandler]
        └─► Buat FolioItem (type: POS_CHARGE, pos_transaction_id: ...)
```

**Redis key untuk RTR:**
```
folio:active:{hid}:{room_number}
  Value: { folioId, guestId, guestName, creditLimit, balance }
  Set  : saat check-in
  Del  : saat check-out
  TTL  : departure_date + 12 jam (safety net)
```

---

## 4. PMS + POS → Alava Accounting (Journal Rule Engine)

Semua accounting entries dibuat secara **otomatis dari domain events**.
Mapping event → double-entry disimpan di tabel `journal_rules` (DB-driven, tidak hardcode).

```
Domain Event                     Debit                    Credit
─────────────────────────────────────────────────────────────────────────
NightAuditRoomChargeEvent      → 1200 AR-Tamu           / 4100 Room Revenue
                               → 1200 AR-Tamu           / 2300 Tax Payable
CheckInDepositReceivedEvent    → 1100 Cash/Clearing     / 2400 Guest Deposit
CheckOutSettledCashEvent       → 2400 Guest Deposit     / 1200 AR-Tamu
PaymentByCreditCardEvent       → 1110 Card Clearing     / 1200 AR-Tamu
POSChargePostedToRoomEvent     → 1200 AR-Tamu           / 4200 F&B Revenue
POSDirectPaymentCashEvent      → 1100 Cash/Clearing     / 4200 F&B Revenue
OTACommissionInvoiceEvent      → 5100 OTA Commission    / 2100 AP-OTA
StockReceiptPostedEvent        → 1300 Inventory Asset   / 2100 AP-Supplier
AssetDepreciationRunEvent      → 5200 Depreciation Exp  / 1500 Accum. Deprec.
```

**Immutability guarantee:**
- `journal_entries` yang sudah `POSTED` tidak dapat diubah
- Koreksi = buat reversal entry baru (debit/kredit dibalik)
- Field `reversed_by_entry_id` self-ref untuk audit trail
- `accounting_periods.status = LOCKED` → tolak semua posting ke periode tersebut

---

## 5. Inventory → POS + Alava Accounting

```
[POS Transaction completed]
        │
        ▼  (via Cost Recipe)
[Inventory] Deduct bahan baku dari store stock berdasarkan pos_recipe_items
        │
        ▼  publishes
InventoryConsumptionEvent { items: [{ inventoryItemId, qty, cost }] }
        │
        ▼  subscribes
[Accounting] → DR COGS / CR Inventory Asset

[Receive Stock dari Supplier]
        │
        ▼  publishes
StockReceiptPostedEvent { poId, receiptId, totalAmount }
        │
        ├─► [Inventory] Update store_stock_balances
        └─► [Accounting] DR Inventory Asset / CR Accounts Payable
```

---

## 6. Night Audit Flow (Proses Akhir Hari)

`NightAuditService` adalah satu-satunya domain service yang boleh mengkoordinasi
proses lintas-modul. Ini mencegah circular dependency.

```
21:00 — Pre-Audit Check
  ✓ Semua outlet POS sudah Dayend Close
  ✓ Tidak ada folio dengan unusual balance
  ✓ Tidak ada reservation room tanpa rate

23:59 — Night Audit Run (BullMQ scheduled job)
  Step 1: [PMS]         Global Post Transaction
          → posting room rate ke semua folio aktif (tamu in-house)
  Step 2: [PMS]         Auto Post Transaction
          → posting charges otomatis: sarapan, internet, minibar (jika ada rule)
  Step 3: [CMS]         Data Competitor Input
          → simpan harga kompetitor hari ini ke competitor_rates
  Step 4: [PMS]         Dayend Close
          → tutup tanggal operasional, buka tanggal baru
  Step 5: [Accounting]  Auto-post Journal Entries
          → semua pending charges hari ini menjadi POSTED journal entries
  Step 6: [CMS]         Availability Update
          → hitung ulang availability_blocks untuk D+1 dan seterusnya
  Step 7: [System]      Generate Reports
          → Daily Revenue Report, Cashier Report, Room Count Sheet (async PDF)

00:01 — Post-Audit
  ✓ night_audit_runs.status = COMPLETED
  ✓ Notifikasi ke manajer via email/push
```

---

## 7. Redis Usage Patterns (Lengkap)

| Key Pattern | Value | TTL | Diset oleh | Dihapus oleh |
|---|---|---|---|---|
| `avail:{hid}:{rtid}:{date}` | `{total, available}` | 15 min | CMS sync | `RoomInventoryUpdatedEvent` |
| `rate:{hid}:{rpid}:{date}` | rate amount | 30 min | CMS | `RateChangedEvent` |
| `folio:active:{hid}:{room}` | folio + guest info | checkout +12h | Check-in | Check-out |
| `auth:session:{userId}` | JWT refresh token | 24h rolling | Login | Logout |
| `cms:webhook:{ota}:{ref}` | `1` (flag) | 24h | Webhook receive | Auto-expire |
| `audit:lock:{hid}:{date}` | `1` (mutex) | 2h | Night Audit start | Night Audit end |
| `comp:rate:{hid}:{date}` | competitor rates | 24h | Alava Insight | Auto-expire |

---

## 8. BullMQ Queue Jobs

| Queue | Job | Trigger | Max Retry |
|---|---|---|---|
| `cms-push` | Push availability ke OTA | `RoomInventoryUpdatedEvent` | 5x exp backoff |
| `cms-pull` | Pull reservasi dari OTA | Cron tiap 15 menit | 3x |
| `night-audit` | Jalankan night audit | Cron 23:59 | 1x (manual retry) |
| `report-gen` | Generate PDF reports | Post night-audit | 3x |
| `email-notify` | Kirim konfirmasi reservasi | `ReservationConfirmedEvent` | 5x |
| `inventory-cost` | Hitung ulang average price | Post stock receipt | 3x |
| `depreciation` | Hitung depresiasi aset | Cron tanggal 1 tiap bulan | 3x |
| `folio-reminder` | Reminder checkout besok | Cron 08:00 | 2x |
