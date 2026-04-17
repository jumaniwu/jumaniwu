# Alava Hotel OS — Architecture Documentation

> **Step 1 Deliverable:** High-Level Architecture & Master Database Schema  
> Dibaca bersama file-file di folder `docs/architecture/`

---

## Daftar Dokumen

| File | Isi |
|---|---|
| [01-overview.md](docs/architecture/01-overview.md) | Product ecosystem, tech stack, directory structure, migration path |
| [02-communication-patterns.md](docs/architecture/02-communication-patterns.md) | Pola komunikasi antar modul, Night Audit flow, Redis patterns |
| [03-erd-pms.md](docs/architecture/03-erd-pms.md) | ERD: Core PMS — Hotels, Rooms, Guests, Reservations, Folios |
| [04-erd-cms-pos.md](docs/architecture/04-erd-cms-pos.md) | ERD: Channel Manager (foundation) + POS |
| [05-erd-accounting-inventory.md](docs/architecture/05-erd-accounting-inventory.md) | ERD: Accounting, Inventory, Fixed Asset, Banquet (foundation) |
| [06-design-decisions.md](docs/architecture/06-design-decisions.md) | Keputusan desain kritis, integrasi pihak ketiga, roadmap |

---

## Ringkasan Ekosistem Alava

```
┌─────────────────────────────────────────────────────────┐
│                    ALAVA HOTEL OS                        │
├──────────────┬──────────────┬──────────────────────────┤
│   TAHAP 1    │   TAHAP 2    │        TAHAP 3            │
├──────────────┼──────────────┼──────────────────────────┤
│ Alava PMS    │ Alava POS    │ Alava Channel Manager     │
│ Alava        │ Alava        │ (Full — semua OTA dunia)  │
│ Booking      │ Accounting   │ Alava Banquet             │
│ Engine       │ Alava        │ Alava Insight             │
│ Alava CMS    │ Inventory    │ Alava Revenue Manager     │
│ (foundation) │ Alava HMS    │ Alava Reputation Hub      │
│              │ Mobile       │ Alava Co-Pilot (AI)       │
└──────────────┴──────────────┴──────────────────────────┘
```
