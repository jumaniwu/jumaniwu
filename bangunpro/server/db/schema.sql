-- BangunPro Database Schema
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS tenants (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  plan TEXT DEFAULT 'trial',
  license_key TEXT,
  expires_at TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id INTEGER REFERENCES tenants(id),
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT DEFAULT 'admin',
  is_demo INTEGER DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS projects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id INTEGER REFERENCES tenants(id),
  name TEXT NOT NULL,
  type TEXT DEFAULT 'gedung',
  lokasi TEXT,
  pemilik TEXT,
  tanggal_mulai TEXT,
  estimasi_selesai TEXT,
  status TEXT DEFAULT 'aktif',
  active INTEGER DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS rab_divisions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
  roman_number TEXT,
  name TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS rab_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
  division_id INTEGER REFERENCES rab_divisions(id) ON DELETE CASCADE,
  no INTEGER,
  uraian TEXT NOT NULL,
  volume REAL DEFAULT 0,
  satuan TEXT DEFAULT 'm2',
  harga_satuan REAL DEFAULT 0,
  subtotal REAL DEFAULT 0,
  analisa_source TEXT,
  sub_division TEXT,
  sort_order INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS invoices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
  no_invoice TEXT,
  keterangan_termin TEXT,
  tanggal_invoice TEXT,
  jatuh_tempo TEXT,
  mode_harga TEXT DEFAULT 'persen',
  persentase REAL DEFAULT 0,
  nominal REAL DEFAULT 0,
  status TEXT DEFAULT 'pending',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS kas_realisasi (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
  tanggal TEXT NOT NULL,
  kategori TEXT NOT NULL,
  alokasi_item_id INTEGER REFERENCES rab_items(id),
  keterangan TEXT,
  nominal REAL DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS kurva_s (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
  minggu INTEGER NOT NULL,
  plan_pct REAL DEFAULT 0,
  realisasi_pct REAL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS progress_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
  rab_item_id INTEGER REFERENCES rab_items(id) ON DELETE CASCADE,
  progress_fisik REAL DEFAULT 0,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS master_harga (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id INTEGER REFERENCES tenants(id),
  nama TEXT NOT NULL,
  satuan TEXT,
  harga REAL DEFAULT 0,
  std_wilayah REAL DEFAULT 0,
  kategori TEXT,
  wilayah TEXT DEFAULT 'Standar DKI Jakarta'
);

CREATE TABLE IF NOT EXISTS master_analisa (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id INTEGER REFERENCES tenants(id),
  kode TEXT,
  nama TEXT NOT NULL,
  satuan TEXT,
  kategori TEXT,
  sumber TEXT DEFAULT 'SNI',
  koefisien_json TEXT,
  harga_satuan REAL DEFAULT 0
);
