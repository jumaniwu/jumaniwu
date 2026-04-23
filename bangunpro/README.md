# BangunPro — Aplikasi Manajemen Konstruksi Profesional

Platform SaaS manajemen konstruksi untuk kontraktor Indonesia. Mencakup RAB (AHSP SNI 2024), Kurva S, Invoice & Termin, Logistik, Keuangan, dan Progress Pekerjaan — semua dalam satu dashboard.

## Prerequisites

- Node.js v18+
- npm v8+

## Instalasi

```bash
git clone <repo>
cd bangunpro

# Install semua dependencies
npm run install-all
```

Atau manual:

```bash
npm install
cd client && npm install && cd ..
cd server && npm install && cd ..
```

## Menjalankan Aplikasi

```bash
npm run dev
```

- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:5000/api

## Akun Demo

| Email | Password | Keterangan |
|-------|----------|------------|
| demo@bangunpro.id | demo123 | Akun demo dengan data lengkap |

## Fitur Utama

| Modul | Deskripsi |
|-------|-----------|
| **Dashboard** | Overview proyek aktif, stat cards, quick actions, distribusi anggaran |
| **Data Proyek** | Kelola multiple proyek, buka workspace |
| **Rekapitulasi RAB** | Builder RAB dengan AHSP SNI 2024, analisis profit, export PDF |
| **Invoice & Termin** | Penagihan bertahap, tracking status lunas/pending |
| **Logistik** | Kebutuhan material & tenaga kerja otomatis dari koefisien AHSP |
| **Kurva S** | Chart plan vs realisasi, simulasi termin, update progress mingguan |
| **Keuangan** | Catat pengeluaran, riwayat kas, sisa budget |
| **Progress** | Progress fisik per item, bobot proporsional RAB |
| **Master Harga** | Harga material per wilayah (DKI, Jabar, Jatim, dll) |
| **Master Analisa** | Library AHSP SNI 2024 dengan koefisien material & tenaga |
| **Pekerjaan Konstruksi** | Sub-pages per kategori (Persiapan, Pondasi, Beton, dll) |

## Tech Stack

| Layer | Teknologi |
|-------|-----------|
| Frontend | React 18 + Vite + Tailwind CSS |
| Routing | React Router v6 |
| Charts | Recharts |
| Icons | Lucide React |
| Forms | React Hook Form |
| Toast | React Hot Toast |
| HTTP | Axios |
| Backend | Node.js + Express.js |
| Database | SQLite via better-sqlite3 |
| Auth | JWT (access token di localStorage) |

## Struktur Folder

```
bangunpro/
├── client/                 # React frontend
│   └── src/
│       ├── components/
│       │   ├── ui/         # Button, Modal, Badge, dll
│       │   └── layout/     # Sidebar, Topbar, Layout
│       ├── pages/          # Semua halaman
│       ├── context/        # AuthContext, ProjectContext
│       └── lib/            # api.js, rupiah.js
├── server/                 # Express backend
│   ├── routes/             # API routes
│   ├── middleware/         # auth.js
│   └── db/                 # schema, seed, database
└── package.json            # Root scripts (concurrently)
```

## Design System

- **Primary**: `#F5A623` (Yellow/Gold)
- **Navy**: `#1A1A2E`
- **Sidebar**: `#16213E` (dark navy)
- **Font**: Inter (Google Fonts)
- **Currency**: `Rp 1.234.567` (toLocaleString id-ID)

## API Endpoints

```
POST /api/auth/login          - Login
POST /api/auth/register       - Register
GET  /api/auth/me             - Current user
GET  /api/license/status      - Status lisensi

GET  /api/projects            - List proyek
POST /api/projects            - Buat proyek
POST /api/projects/:id/set-active  - Set aktif

GET  /api/rab/:projectId      - Data RAB
POST /api/rab/:projectId/items     - Tambah item
PUT  /api/rab/items/:id       - Update item

GET  /api/dashboard           - Dashboard data
GET  /api/invoice/:projectId  - Invoice list
GET  /api/kurvas/:projectId   - Kurva S data
PUT  /api/kurvas/:projectId   - Update Kurva S
GET  /api/keuangan/:projectId - Transaksi list
POST /api/keuangan/:projectId - Catat transaksi
GET  /api/progress/:projectId - Progress items
PUT  /api/progress/:projectId/items/:itemId  - Update progress
GET  /api/logistik/:projectId - Logistik data
GET  /api/master-harga        - Master harga
GET  /api/master-analisa      - AHSP library
```
