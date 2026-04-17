# 06 — Key Design Decisions & Integration Map

## 1. Folio System: Master / Desk / City Ledger

Satu reservasi dapat memiliki lebih dari satu folio untuk memisahkan tagihan:

```
Reservation
  └── Master Folio (folio_type: MASTER)
        ├── Room Rate charges       → default semua charge masuk sini
        ├── POS charges (RTR)
        └── Desk Folio (folio_type: DESK, parent_folio_id → Master)
              └── Laundry, Telephone, dsb (dipisah atas permintaan tamu)

  └── City Ledger Folio (folio_type: CITY_LEDGER)
        └── Tagihan langsung ke company/corporate
```

**Aturan:**
- `folio_items` dengan `item_type: PAYMENT` mengurangi balance folio
- Transfer antar folio membuat dua `folio_items`: TRANSFER_OUT + TRANSFER_IN
- Folio tidak bisa di-close jika balance > 0

---

## 2. Captain Order vs POS Transaction

| Aspek | Captain Order | POS Transaction |
|---|---|---|
| Dibuat oleh | Waiter/Server | Kasir |
| Tujuan | Alur dapur (kitchen flow) | Alur kasir (billing) |
| Status utama | COOKING → READY → SERVED | OPEN → CLOSED |
| Hubungan | 1 Captain Order | → 1 POS Transaction |
| Split bill | Split menjadi beberapa TX | Ya, dari 1 Captain Order |

Captain Order adalah **order slip ke dapur**. POS Transaction adalah **bill tamu**.
Pemisahan ini memungkinkan kasir membuka bill dari order yang sudah selesai,
dan dapur tidak terpengaruh proses billing.

---

## 3. Cost Recipe → Inventory Auto-Deduction

Saat `pos_transaction_items` di-post (status CLOSED):

```
1. Lookup pos_items.has_recipe → true
2. Fetch pos_recipes + pos_recipe_items untuk item tersebut
3. Untuk setiap bahan:
   Deduct qty × quantity_sold dari store_stock (store outlet)
4. Publish InventoryConsumptionEvent
5. [Accounting] DR COGS / CR Inventory Asset (via Journal Rule Engine)
```

Store yang digunakan = store yang terhubung ke `pos_outlet` melalui `sub_department`.

---

## 4. Journal Rule Engine

Mapping domain event → double-entry accounting **disimpan di database** (`journal_rules`),
bukan di hardcode. Hotel dapat mengkonfigurasi akun GL via UI Alava Accounting.

```
journal_rules
  source_event    = 'NightAuditRoomChargeEvent'
  line_number     = 1
  entry_type      = 'DEBIT'
  ledger_account  = 1200 (AR-Tamu)
  amount_field    = 'payload.room_rate_amount'

  source_event    = 'NightAuditRoomChargeEvent'
  line_number     = 2
  entry_type      = 'CREDIT'
  ledger_account  = 4100 (Room Revenue)
  amount_field    = 'payload.room_rate_amount'
```

**Immutability rules:**
- `journal_entries.status = POSTED` → tidak dapat diubah
- Koreksi = buat reversal entry baru → linked via `reversed_by_id`
- `accounting_periods.status = LOCKED` → tolak semua posting ke periode tersebut
- `accounting_periods.status = CLOSED` → periode tahunan, tidak dapat dibuka kembali

---

## 5. Night Audit sebagai Single Orchestrator

`NightAuditService` adalah **satu-satunya** domain service yang boleh memicu proses
lintas-modul secara terkoordinasi. Ini mencegah circular dependency antar bounded context.

Semua modul lain hanya **bereaksi terhadap events** yang dipublikasikan Night Audit,
bukan dipanggil langsung.

```
NightAuditService.run(hotelId, auditDate)
  ├── emit NightAuditStartedEvent      → semua modul siapkan data
  ├── emit GlobalPostTransactionEvent  → [PMS] post room rate ke semua folio
  ├── emit AutoPostTransactionEvent    → [PMS] post charges otomatis (sarapan, dsb)
  ├── emit DayendCloseEvent            → [POS] tutup semua outlet
  ├── emit AccountingAutoPostEvent     → [Accounting] post semua pending entries
  ├── emit AvailabilityRecalcEvent     → [CMS] recalculate D+1 availability
  └── emit NightAuditCompletedEvent    → [System] generate reports, send notifications
```

---

## 6. Alava Channel Manager — Dua Fase

### Tahap 1 (Foundation):
- Schema: `channels`, `rate_plans`, `rate_plan_rates`, `channel_room_mappings`, `availability_blocks`
- Webhook receiver untuk inbound OTA bookings
- Basic push ke 2–3 OTA utama (Booking.com, Agoda) via REST API langsung
- Redis availability cache dengan invalidation on event

### Tahap 3 (Full Proprietary Product — Microservice):
Dikembangkan sebagai **standalone microservice** yang bisa dijual ke hotel lain
(bahkan yang tidak pakai Alava PMS).

```
Standar yang didukung:
  HTNG 2.0 (XML/SOAP)    → Booking.com, Agoda, Expedia
  OpenTravel Alliance     → OTA legacy (mayoritas Asia)
  REST/JSON               → Airbnb, Traveloka, Tiket.com, Trip.com
  GDS — Amadeus           → Travel agent global
  GDS — Sabre             → Travel agent global
  GDS — Travelport        → Travel agent global
  Meta Search             → Google Hotel, TripAdvisor, Trivago
  Wholesaler              → Hotelbeds, Miki Travel

Entitas tambahan Tahap 3:
  ota_adapters            Registry semua OTA yang didukung + versi API
  ota_connections         Kredensial + status per hotel per OTA
  channel_sync_logs       Audit log setiap push/pull operation
  booking_webhook_logs    Raw log inbound webhook dari OTA
  rate_parity_rules       Aturan parity rate per hotel
  rate_parity_violations  Alert pelanggaran rate parity

IOTAAdapter interface (kontrak semua adapter):
  pushAvailability()     push ketersediaan kamar
  pushRates()            push harga
  pushRestrictions()     push min stay, stop sell, CTA/CTD
  pullReservations()     tarik reservasi baru
  acknowledgeReservation() konfirmasi penerimaan booking
  cancelReservation()    kirim pembatalan ke OTA
  testConnection()       tes konektivitas
```

---

## 7. Chart of Accounts — Hierarki 4 Level

```
ASSET (Level 1 — account_type)
  └── 1000 Current Assets (Level 2 — account_subtype)
        └── 1100 Cash & Bank (Level 3 — account_subgroup)
              ├── 1101 Cash on Hand
              ├── 1102 Petty Cash
              └── 1110 Bank — BCA
        └── 1200 Accounts Receivable
              ├── 1201 AR Guest (in-house)
              └── 1202 AR City Ledger
        └── 1300 Inventory
  └── 1500 Fixed Assets
        ├── 1510 Buildings
        ├── 1520 Furniture & Fixtures
        └── 1599 Accumulated Depreciation

REVENUE (Level 1)
  └── 4100 Rooms Revenue
        ├── 4101 Room Rate — Deluxe
        └── 4102 Room Rate — Suite
  └── 4200 F&B Revenue
        ├── 4201 Restaurant Revenue
        └── 4202 Bar Revenue
  └── 4300 Other Revenue
```

`ledger_accounts.is_posting_account = true` hanya pada **leaf node** (level terbawah).
Posting ke non-leaf account diblokir oleh sistem.

---

## 8. Integrasi Pihak Ketiga

| Sistem | Alava Module | Protokol | Tahap |
|---|---|---|---|
| OTA (Booking.com, Agoda, Traveloka) | Alava Channel Manager | REST + Webhook | 1 (basic), 3 (full) |
| Keylock Card (Onity, VingCard, Dormakaba) | Alava PMS | Serial/TCP SDK | 2 |
| PABX Telephone (SMDR feed) | Alava PMS | Serial/TCP | 2 |
| Mikrotik Internet (Wicon) | Alava PMS | API | 2 |
| IPTV In-Room Order | Alava POS | REST | 3 |
| Payment Gateway (Midtrans, Xendit, Stripe) | Alava POS + Booking Engine | REST/HTTPS | 1 |
| Google Hotel / Meta Search | Alava Booking Engine | Google Hotel API | 1 |
| WhatsApp Business | Alava PMS (notifikasi) | WhatsApp Business API | 2 |
| Email SMTP | Semua modul | SMTP | 1 |

---

## 9. Pondasi Tahap 3 yang Disiapkan Sejak Awal

| Entitas/Field | Tujuan Tahap 3 |
|---|---|
| `competitor_rates` | Benih data untuk **Alava Revenue Manager** (dynamic pricing) |
| `availability_blocks` dengan timestamp history | Training data untuk **Alava Insight** |
| `guests.visit_count` + `members.tier` | Basis **Alava Reputation Hub** + loyalty |
| `journal_rules` DB-driven | Dapat di-query oleh **Alava Co-Pilot** untuk insight keuangan |
| `banquet_venues` + `banquet_bookings` | Pondasi **Alava Banquet** |
| `pos_recipes` + `inventory_items` | COGS otomatis → **Alava Insight** F&B analytics |
| `folio_items.sub_department_id` | P&L per sub-departemen → **Alava Revenue Manager** |
