# 01 — System Overview & Architecture Style

## 1. Ekosistem Produk Alava

| Modul | Brand Name | Tahap | Keterangan |
|---|---|---|---|
| Property Management System | **Alava PMS** | 1 | Core operasional hotel |
| Direct Booking Engine | **Alava Booking Engine** | 1 | Website booking mandiri + Google/Meta |
| Channel Manager (foundation) | **Alava Channel Manager** | 1 | Schema + webhook receiver saja |
| Point of Sale | **Alava POS** | 2 | F&B, Spa, Room Service, Mini Bar |
| Accounting System | **Alava Accounting** | 2 | GL, AR, AP, P&L, Rekonsiliasi |
| Inventory & Asset | **Alava Inventory** | 2 | Procurement, Stok, Resep, Aset Tetap |
| Mobile Staff App | **Alava HMS Mobile** | 2 | API untuk aplikasi staf mobile |
| Channel Manager (full) | **Alava Channel Manager** | 3 | Semua OTA dunia, adapter pattern |
| Banquet & MICE | **Alava Banquet** | 3 | Venue, Event, Seating Plan |
| Analytics | **Alava Insight** | 3 | Competitor scraping, statistik |
| Revenue Management | **Alava Revenue Manager** | 3 | Dynamic pricing otomatis |
| Reputation Management | **Alava Reputation Hub** | 3 | Dashboard ulasan multi-platform |
| AI Assistant | **Alava Co-Pilot** | 3 | Rekomendasi harga & operasional |

---

## 2. Technology Stack

| Layer | Teknologi | Alasan |
|---|---|---|
| Backend Framework | **NestJS (Node.js + TypeScript)** | Modular DDD, DI native, decorator-based |
| Primary Database | **PostgreSQL 16** | ACID, relasi kompleks PMS+POS+Accounting |
| Cache & Queue | **Redis 7** | Availability cache OTA, Bull queues, Session |
| ORM | **TypeORM** | Migration, multi-tenancy global filter |
| API Protocol | **REST + WebSocket** | REST CRUD, WS untuk realtime HK/POS |
| Authentication | **JWT + Refresh Token** | Stateless, mobile-friendly |
| Job Queue | **BullMQ** | OTA sync, Night Audit scheduler, Reports |
| File Storage | **S3-compatible (MinIO/AWS)** | Dokumen tamu, export laporan PDF |

---

## 3. Arsitektur: Modular Monolith → Microservices

Sistem dibangun dengan **Modular Monolith** berbasis **Domain-Driven Design (DDD)**.
Setiap bounded context hidup di NestJS module-nya sendiri dengan aturan:
- Tidak boleh mengimport repository/entity modul lain secara langsung
- Komunikasi lintas domain hanya via `IEventBus` (async) atau service interface (sync)
- Database shared di Tahap 1–2, split per service di Tahap 3

### Jalur Migrasi

```
Tahap 1-2 — Modular Monolith
  Event Bus : NestJS EventEmitter2 (in-process)
  Database  : 1 PostgreSQL, schema per domain (pms.*, pos.*, accounting.*)
  Deploy    : Single NestJS app

Tahap 2-3 — Pre-split
  Event Bus : Redis Streams (masih 1 deployment, siap split)
  Database  : Schema separation enforced, no cross-schema JOIN di app layer

Tahap 3 — Microservices
  Event Bus : Kafka (1 topic per domain event)
  Database  : Per-service PostgreSQL cluster
  API GW    : Kong / AWS API Gateway
  Note      : Alava Channel Manager = microservice tersendiri dari awal Tahap 3
```

> **Prinsip kunci:** Application code hanya boleh pakai interface `IEventBus`.
> Ganti transport = ubah 1 file infrastruktur, tidak perlu refactor domain logic.

---

## 4. Struktur Direktori

```
/src
  /modules
    /pms                        ← Alava PMS
      /domain
        /reservation            Aggregate: Reservation
        /room                   Aggregate: Room, RoomType
        /guest                  Aggregate: Guest, GuestGroup
        /folio                  Aggregate: Folio, FolioItem
        /housekeeping           Aggregate: HousekeepingTask
        /night-audit            Domain Service: NightAuditService
      /application              Use Cases (NestJS Services)
      /infrastructure           Repositories (TypeORM), Event Handlers
      /api                      REST Controllers, DTOs

    /cms                        ← Alava Channel Manager (Tahap 1: foundation)
      /domain
        /channel
        /rate-plan
        /availability
      /application
      /infrastructure

    /booking-engine             ← Alava Booking Engine
    /pos                        ← Alava POS
    /accounting                 ← Alava Accounting
    /inventory                  ← Alava Inventory
    /banquet                    ← Alava Banquet (Tahap 3, schema foundation)

  /shared
    /infrastructure
      /database                 TypeORM config, migrations
      /cache                    Redis client (ioredis)
      /events                   IEventBus + EventEmitter2 implementation
      /queue                    BullMQ config + base job processor
      /storage                  S3 client
    /kernel
      /auth                     JWT strategy, RBAC guards
      /tenant                   TenantContext middleware (inject hotel_id)
      /audit-log                User activity logging
      /i18n                     Internationalization
```

---

## 5. Multi-Property (Multi-Tenancy)

Setiap tabel memiliki `hotel_id`. `TenantContext` di-inject dari JWT claim ke semua
repository secara otomatis via TypeORM Global Filter — developer tidak perlu
menambahkan `WHERE hotel_id = ?` secara manual.

```typescript
// Base repository — semua query otomatis scoped ke hotel aktif
@Injectable()
export class TenantAwareRepository<T extends { hotel_id: string }> {
  find(options?: FindOptions): Promise<T[]> {
    return this.repo.find({
      ...options,
      where: { ...options?.where, hotel_id: this.tenantContext.hotelId }
    });
  }
}
```
