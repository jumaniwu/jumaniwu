const bcrypt = require('bcryptjs');
const { getDb } = require('./database');

function seed() {
  const db = getDb();

  // Check if already seeded
  const existing = db.prepare('SELECT id FROM tenants WHERE slug = ?').get('demo');
  if (existing) return;

  console.log('🌱 Seeding database...');

  // Create demo tenant
  const tenantResult = db.prepare(`
    INSERT INTO tenants (name, slug, plan, expires_at)
    VALUES ('Demo Tenant', 'demo', 'trial', datetime('now', '+8 hours'))
  `).run();
  const tenantId = tenantResult.lastInsertRowid;

  // Create demo user
  const hash = bcrypt.hashSync('demo123', 10);
  const userResult = db.prepare(`
    INSERT INTO users (tenant_id, name, email, password_hash, role, is_demo)
    VALUES (?, 'Admin Demo', 'demo@bangunpro.id', ?, 'admin', 1)
  `).run(tenantId, hash);

  // Create demo projects
  const proj1 = db.prepare(`
    INSERT INTO projects (tenant_id, name, type, lokasi, pemilik, tanggal_mulai, estimasi_selesai, status, active)
    VALUES (?, 'Rumah Contoh Type 45 Premium (AHSP 2026)', 'gedung', 'Jakarta Selatan', 'Internal', '2026-02-04', '2026-08-04', 'aktif', 1)
  `).run(tenantId);
  const mainProjectId = proj1.lastInsertRowid;

  db.prepare(`
    INSERT INTO projects (tenant_id, name, type, lokasi, pemilik, tanggal_mulai, status, active)
    VALUES (?, 'Proyek EE5', 'gedung', 'Cipinang', 'Ibu Ika', '2026-04-20', 'aktif', 0)
  `).run(tenantId);

  db.prepare(`
    INSERT INTO projects (tenant_id, name, type, lokasi, pemilik, tanggal_mulai, status, active)
    VALUES (?, 'Lokal', 'gedung', 'Sudirman', 'Joyo Toyi', '2026-04-13', 'aktif', 0)
  `).run(tenantId);

  db.prepare(`
    INSERT INTO projects (tenant_id, name, type, lokasi, pemilik, tanggal_mulai, status, active)
    VALUES (?, 'nn', 'gedung', 'nn', 'nn', '2026-04-10', 'aktif', 0)
  `).run(tenantId);

  // RAB Divisions
  const divs = [
    { roman: 'I', name: 'STRUKTUR', order: 1 },
    { roman: 'II', name: 'ARSITEKTUR', order: 2 },
    { roman: 'III', name: 'ATAP & PLAFON', order: 3 },
    { roman: 'IV', name: 'PEKERJAAN PERSIAPAN', order: 4 },
    { roman: 'V', name: 'BINA MARGA - DIVISI 1', order: 5 },
    { roman: 'VI', name: 'FINISHING – PLESTERAN', order: 6 },
    { roman: 'VII', name: 'ARSITEKTUR – FINISHING', order: 7 },
    { roman: 'VIII', name: 'PEKERJAAN PONDASI', order: 8 },
    { roman: 'IX', name: 'BAJA – WF', order: 9 },
  ];

  const divIds = {};
  const insertDiv = db.prepare(`
    INSERT INTO rab_divisions (project_id, roman_number, name, sort_order)
    VALUES (?, ?, ?, ?)
  `);
  for (const d of divs) {
    const r = insertDiv.run(mainProjectId, d.roman, d.name, d.order);
    divIds[d.roman] = r.lastInsertRowid;
  }

  // RAB Items
  const items = [
    { div: 'I', no: 1, uraian: 'Pondasi Batu Kali (AHSP SNI 2024)', volume: 30, satuan: 'm³', harga: 458333, subtotal: 13750000, source: 'ahsp_sni' },
    { div: 'I', no: 2, uraian: 'Sloof Beton 15/20 K-225 (AHSP SNI 2024)', volume: 15, satuan: 'm', harga: 616000, subtotal: 9240000, source: 'ahsp_sni' },
    { div: 'II', no: 3, uraian: 'Lantai Granit 60x60 Polish (AHSP SNI A.4.1.3)', volume: 80, satuan: 'm²', harga: 336875, subtotal: 26950000, source: 'ahsp_sni' },
    { div: 'II', no: 4, uraian: 'Pasangan Bata Merah 1:4 (AHSP SNI A.4.4.1)', volume: 120, satuan: 'm²', harga: 169583, subtotal: 20350000, source: 'ahsp_sni' },
    { div: 'II', no: 5, uraian: 'Plesteran 1:4 & Acian (AHSP SNI A.4.4.2)', volume: 240, satuan: 'm²', harga: 65083, subtotal: 15620000, source: 'ahsp_sni' },
    { div: 'II', no: 6, uraian: 'Pengecatan Dinding Interior 2 Lapis (AHSP SNI A.4.7)', volume: 240, satuan: 'm²', harga: 20625, subtotal: 4950000, source: 'ahsp_sni' },
    { div: 'II', no: 7, uraian: 'Pengecatan Dinding Eksterior 2 Lapis (AHSP SNI A.4.7)', volume: 240, satuan: 'm²', harga: 20625, subtotal: 4950000, source: 'ahsp_sni' },
    { div: 'III', no: 8, uraian: 'Rangka Atap Baja Ringan C75.75 (AHSP SNI C.4)', volume: 90, satuan: 'm²', harga: 201667, subtotal: 18150000, source: 'ahsp_sni' },
    { div: 'IV', no: 9, uraian: 'Pasang Bowplank (AHSP SNI)', volume: 39, satuan: "m'", harga: 171363, subtotal: 6683159, source: 'ahsp_sni' },
    { div: 'IV', no: 10, uraian: 'Mobilisasi Alat (Manual Harga)', volume: 1, satuan: 'Ls', harga: 1222, subtotal: 1222, source: 'manual' },
    { div: 'IV', no: 11, uraian: 'Pasang Bowplank (Depan)', volume: 41, satuan: "m'", harga: 171363, subtotal: 7025886, source: 'ahsp_sni' },
    { div: 'V', no: 12, uraian: '1.2 Mobilisasi & Demobilisasi', volume: 1, satuan: 'Ls', harga: 7700000, subtotal: 8470000, source: 'manual' },
    { div: 'VI', no: 13, uraian: 'Plesteran Dinding 1:4 (Lantai 1) + Acian + Scaffolding', volume: 64, satuan: 'm²', harga: 105509, subtotal: 6752557, source: 'ahsp_sni' },
    { div: 'VI', no: 14, uraian: 'Plesteran Dinding 1:4 (Lantai 1) + Acian + Scaffolding (Sisi B)', volume: 64, satuan: 'm²', harga: 105509, subtotal: 6752557, source: 'ahsp_sni' },
    { div: 'VII', no: 15, uraian: 'Plafon Gypsum flat [Merk: Dulux]', volume: 300, satuan: 'm²', harga: 138820, subtotal: 41646000, source: 'manual' },
    { div: 'VIII', no: 16, uraian: 'Pondasi Batu Kali + Lantai Kerja & Pasir', volume: 3.6, satuan: 'm³', harga: 1171165, subtotal: 4216194, source: 'ahsp_sni' },
    { div: 'IX', no: 17, uraian: 'Baja WF (Wide Flange) Profil WF 400x200 (9m x 6m)', volume: 3787.8, satuan: 'kg', harga: 132193, subtotal: 500720233, source: 'ahsp_sni' },
  ];

  const insertItem = db.prepare(`
    INSERT INTO rab_items (project_id, division_id, no, uraian, volume, satuan, harga_satuan, subtotal, analisa_source, sort_order)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const itemIds = [];
  for (const [i, item] of items.entries()) {
    const r = insertItem.run(
      mainProjectId, divIds[item.div], item.no,
      item.uraian, item.volume, item.satuan,
      item.harga, item.subtotal, item.source, i
    );
    itemIds.push(r.lastInsertRowid);
  }

  // Kurva S data
  const kurvaData = [
    { minggu: 1, plan: 5, real: 5 },
    { minggu: 2, plan: 20, real: 25 },
    { minggu: 3, plan: 35, real: 30 },
    { minggu: 4, plan: 45, real: 35 },
    { minggu: 5, plan: 80, real: 85 },
    { minggu: 6, plan: 95, real: 90 },
    { minggu: 7, plan: 100, real: 95 },
  ];
  const insertKurva = db.prepare(`
    INSERT INTO kurva_s (project_id, minggu, plan_pct, realisasi_pct)
    VALUES (?, ?, ?, ?)
  `);
  for (const k of kurvaData) {
    insertKurva.run(mainProjectId, k.minggu, k.plan, k.real);
  }

  // Progress items (default 0%)
  const insertProgress = db.prepare(`
    INSERT INTO progress_items (project_id, rab_item_id, progress_fisik)
    VALUES (?, ?, 0)
  `);
  for (const itemId of itemIds) {
    insertProgress.run(mainProjectId, itemId);
  }

  // Master Harga - DKI Jakarta
  seedMasterHarga(db, tenantId);

  // Master Analisa
  seedMasterAnalisa(db, tenantId);

  console.log('✅ Database seeded successfully');
}

function seedMasterHarga(db, tenantId) {
  const items = [
    // Sipil & Struktur
    { nama: 'Semen 50Kg', satuan: 'Zak', harga: 65000, std: 65000, kategori: 'Sipil & Struktur' },
    { nama: 'Semen Putih', satuan: 'Zak', harga: 85000, std: 85000, kategori: 'Sipil & Struktur' },
    { nama: 'Pasir Beton/Pasang', satuan: 'm³', harga: 250000, std: 250000, kategori: 'Sipil & Struktur' },
    { nama: 'Batu Kali', satuan: 'm³', harga: 180000, std: 180000, kategori: 'Sipil & Struktur' },
    { nama: 'Ready Mix K-225', satuan: 'm³', harga: 950000, std: 950000, kategori: 'Sipil & Struktur' },
    { nama: 'Ready Mix K-250', satuan: 'm³', harga: 1000000, std: 1000000, kategori: 'Sipil & Struktur' },
    { nama: 'Ready Mix K-300', satuan: 'm³', harga: 1100000, std: 1100000, kategori: 'Sipil & Struktur' },
    { nama: 'Bata Merah', satuan: 'Biji', harga: 800, std: 800, kategori: 'Sipil & Struktur' },
    { nama: 'Hebel/Bata Ringan', satuan: 'm²', harga: 75000, std: 75000, kategori: 'Sipil & Struktur' },
    { nama: 'Batako', satuan: 'Biji', harga: 5000, std: 5000, kategori: 'Sipil & Struktur' },
    { nama: 'Kayu Kaso 5/7', satuan: 'Batang', harga: 25000, std: 25000, kategori: 'Sipil & Struktur' },
    { nama: 'Papan Cor', satuan: 'Lbr', harga: 120000, std: 120000, kategori: 'Sipil & Struktur' },
    { nama: 'Paku Campur', satuan: 'Kg', harga: 20000, std: 20000, kategori: 'Sipil & Struktur' },
    { nama: 'Kawat Bendrat', satuan: 'Kg', harga: 18000, std: 18000, kategori: 'Sipil & Struktur' },
    { nama: 'Koral/Split Beton', satuan: 'm³', harga: 280000, std: 280000, kategori: 'Sipil & Struktur' },
    { nama: 'Minyak Bekisting', satuan: 'Liter', harga: 12000, std: 12000, kategori: 'Sipil & Struktur' },
    // Besi Beton
    { nama: 'Besi 6mm Polos', satuan: 'Kg', harga: 11000, std: 11000, kategori: 'Besi Beton' },
    { nama: 'Besi 8mm Polos', satuan: 'Kg', harga: 11000, std: 11000, kategori: 'Besi Beton' },
    { nama: 'Besi 10mm', satuan: 'Kg', harga: 11500, std: 11500, kategori: 'Besi Beton' },
    { nama: 'Besi 12mm Ulir', satuan: 'Kg', harga: 12000, std: 12000, kategori: 'Besi Beton' },
    { nama: 'Besi 13mm Ulir', satuan: 'Kg', harga: 12000, std: 12000, kategori: 'Besi Beton' },
    { nama: 'Besi 16mm Ulir', satuan: 'Kg', harga: 12500, std: 12500, kategori: 'Besi Beton' },
    { nama: 'Besi 19mm Ulir', satuan: 'Kg', harga: 13000, std: 13000, kategori: 'Besi Beton' },
    { nama: 'Besi 22mm Ulir', satuan: 'Kg', harga: 13500, std: 13500, kategori: 'Besi Beton' },
    // Konstruksi Baja
    { nama: 'Baja Ringan C75', satuan: 'Batang', harga: 85000, std: 85000, kategori: 'Konstruksi Baja' },
    { nama: 'Reng Baja', satuan: 'Batang', harga: 35000, std: 35000, kategori: 'Konstruksi Baja' },
    { nama: 'Baja WF/H-Beam', satuan: 'Kg', harga: 15000, std: 15000, kategori: 'Konstruksi Baja' },
    { nama: 'Besi CNP/Kanal', satuan: 'Kg', harga: 14000, std: 14000, kategori: 'Konstruksi Baja' },
    { nama: 'Besi Siku', satuan: 'Kg', harga: 14000, std: 14000, kategori: 'Konstruksi Baja' },
    { nama: 'Besi Pipa/Hollow', satuan: 'Kg', harga: 15000, std: 15000, kategori: 'Konstruksi Baja' },
    { nama: 'Kawat Las/Elektroda', satuan: 'Kg', harga: 25000, std: 25000, kategori: 'Konstruksi Baja' },
    { nama: 'Cat Anti Karat/Meni Besi', satuan: 'Kg', harga: 85000, std: 85000, kategori: 'Konstruksi Baja' },
    // Arsitektur & Finishing
    { nama: 'Granit 60x60', satuan: 'Dus', harga: 175000, std: 175000, kategori: 'Arsitektur & Finishing' },
    { nama: 'Keramik 40x40', satuan: 'Dus', harga: 85000, std: 85000, kategori: 'Arsitektur & Finishing' },
    { nama: 'Nat Keramik', satuan: 'Kg', harga: 12000, std: 12000, kategori: 'Arsitektur & Finishing' },
    { nama: 'Lem Keramik', satuan: 'Sak', harga: 65000, std: 65000, kategori: 'Arsitektur & Finishing' },
    { nama: 'Gypsum Board', satuan: 'Lembar', harga: 75000, std: 75000, kategori: 'Arsitektur & Finishing' },
    { nama: 'Hollow 4x4', satuan: 'Batang', harga: 75000, std: 75000, kategori: 'Arsitektur & Finishing' },
    { nama: 'Hollow 2x4', satuan: 'Batang', harga: 45000, std: 45000, kategori: 'Arsitektur & Finishing' },
    { nama: 'Atap Spandek', satuan: 'm²', harga: 110000, std: 110000, kategori: 'Arsitektur & Finishing' },
    { nama: 'Genteng Metal', satuan: 'Lembar', harga: 65000, std: 65000, kategori: 'Arsitektur & Finishing' },
    { nama: 'Genteng Beton', satuan: 'Keping', harga: 8500, std: 8500, kategori: 'Arsitektur & Finishing' },
    { nama: 'Genteng Keramik', satuan: 'Keping', harga: 12000, std: 12000, kategori: 'Arsitektur & Finishing' },
    { nama: 'Bondek Cor', satuan: 'm²', harga: 120000, std: 120000, kategori: 'Arsitektur & Finishing' },
    // Cat & Pelapis
    { nama: 'Cat Tembok 25Kg', satuan: 'Pail', harga: 650000, std: 650000, kategori: 'Cat & Pelapis' },
    { nama: 'Cat Tembok 5Kg', satuan: 'Galon', harga: 150000, std: 150000, kategori: 'Cat & Pelapis' },
    { nama: 'Cat Dasar', satuan: 'Kg', harga: 35000, std: 35000, kategori: 'Cat & Pelapis' },
    { nama: 'Plamir', satuan: 'Kg', harga: 25000, std: 25000, kategori: 'Cat & Pelapis' },
    // MEP
    { nama: 'Kabel NYM 2x1.5', satuan: 'Roll', harga: 450000, std: 450000, kategori: 'MEP (Listrik & Plumbing)' },
    { nama: 'Lampu LED', satuan: 'Pcs', harga: 45000, std: 45000, kategori: 'MEP (Listrik & Plumbing)' },
    { nama: 'Saklar', satuan: 'Pcs', harga: 35000, std: 35000, kategori: 'MEP (Listrik & Plumbing)' },
    { nama: 'Stopkontak', satuan: 'Pcs', harga: 45000, std: 45000, kategori: 'MEP (Listrik & Plumbing)' },
    { nama: 'Pipa PVC', satuan: 'Batang', harga: 55000, std: 55000, kategori: 'MEP (Listrik & Plumbing)' },
    { nama: 'Fitting Pipa', satuan: 'Pcs', harga: 15000, std: 15000, kategori: 'MEP (Listrik & Plumbing)' },
    // Upah Tenaga
    { nama: 'Mandor', satuan: 'OH', harga: 185000, std: 185000, kategori: 'Upah Tenaga' },
    { nama: 'Kepala Tukang', satuan: 'OH', harga: 160000, std: 160000, kategori: 'Upah Tenaga' },
    { nama: 'Tukang Batu', satuan: 'OH', harga: 145000, std: 145000, kategori: 'Upah Tenaga' },
    { nama: 'Tukang Besi', satuan: 'OH', harga: 145000, std: 145000, kategori: 'Upah Tenaga' },
    { nama: 'Tukang Kayu', satuan: 'OH', harga: 145000, std: 145000, kategori: 'Upah Tenaga' },
    { nama: 'Tukang Cat', satuan: 'OH', harga: 145000, std: 145000, kategori: 'Upah Tenaga' },
    { nama: 'Pekerja', satuan: 'OH', harga: 117600, std: 117600, kategori: 'Upah Tenaga' },
  ];

  const insert = db.prepare(`
    INSERT INTO master_harga (tenant_id, nama, satuan, harga, std_wilayah, kategori, wilayah)
    VALUES (?, ?, ?, ?, ?, ?, 'Standar DKI Jakarta')
  `);
  for (const item of items) {
    insert.run(tenantId, item.nama, item.satuan, item.harga, item.std, item.kategori);
  }
}

function seedMasterAnalisa(db, tenantId) {
  const items = [
    {
      kode: 'SNI-1', nama: 'Pondasi Batu Kali', satuan: 'm³', kategori: 'Pondasi', sumber: 'SNI',
      koefisien: { material: [{ nama: 'Batu Kali', koef: 1.2, satuan: 'm³' }, { nama: 'Semen 50Kg', koef: 0.163, satuan: 'Zak' }, { nama: 'Pasir Beton/Pasang', koef: 0.52, satuan: 'm³' }], tenaga: [{ posisi: 'Tukang Batu', koef: 1.5, satuan: 'OH' }, { posisi: 'Pekerja', koef: 4.5, satuan: 'OH' }] },
      harga: 458333
    },
    {
      kode: 'SNI-2', nama: 'Sloof Beton 15/20 K-225', satuan: 'm', kategori: 'Struktur', sumber: 'SNI',
      koefisien: { material: [{ nama: 'Ready Mix K-225', koef: 0.036, satuan: 'm³' }, { nama: 'Besi 12mm Ulir', koef: 2.5, satuan: 'Kg' }], tenaga: [{ posisi: 'Tukang Batu', koef: 0.2, satuan: 'OH' }, { posisi: 'Pekerja', koef: 0.6, satuan: 'OH' }] },
      harga: 616000
    },
    {
      kode: 'A.4.1.3', nama: 'Lantai Granit 60x60 Polish', satuan: 'm²', kategori: 'Arsitektur', sumber: 'SNI',
      koefisien: { material: [{ nama: 'Granit 60x60', koef: 0.44, satuan: 'Dus' }, { nama: 'Lem Keramik', koef: 0.13, satuan: 'Sak' }, { nama: 'Nat Keramik', koef: 0.1, satuan: 'Kg' }], tenaga: [{ posisi: 'Tukang Batu', koef: 0.25, satuan: 'OH' }, { posisi: 'Pekerja', koef: 0.083, satuan: 'OH' }] },
      harga: 336875
    },
    {
      kode: 'A.4.4.1', nama: 'Pasangan Bata Merah 1:4', satuan: 'm²', kategori: 'Arsitektur', sumber: 'SNI',
      koefisien: { material: [{ nama: 'Bata Merah', koef: 70, satuan: 'Biji' }, { nama: 'Semen 50Kg', koef: 0.163, satuan: 'Zak' }, { nama: 'Pasir Beton/Pasang', koef: 0.034, satuan: 'm³' }], tenaga: [{ posisi: 'Tukang Batu', koef: 0.1, satuan: 'OH' }, { posisi: 'Pekerja', koef: 0.3, satuan: 'OH' }] },
      harga: 169583
    },
    {
      kode: 'A.4.4.2', nama: 'Plesteran 1:4 & Acian', satuan: 'm²', kategori: 'Arsitektur', sumber: 'SNI',
      koefisien: { material: [{ nama: 'Semen 50Kg', koef: 0.12, satuan: 'Zak' }, { nama: 'Pasir Beton/Pasang', koef: 0.024, satuan: 'm³' }, { nama: 'Semen Putih', koef: 0.08, satuan: 'Zak' }], tenaga: [{ posisi: 'Tukang Batu', koef: 0.15, satuan: 'OH' }, { posisi: 'Pekerja', koef: 0.3, satuan: 'OH' }] },
      harga: 65083
    },
    {
      kode: 'A.4.7', nama: 'Pengecatan Dinding 2 Lapis', satuan: 'm²', kategori: 'Cat', sumber: 'SNI',
      koefisien: { material: [{ nama: 'Cat Tembok 25Kg', koef: 0.02, satuan: 'Pail' }, { nama: 'Cat Dasar', koef: 0.01, satuan: 'Kg' }, { nama: 'Plamir', koef: 0.1, satuan: 'Kg' }], tenaga: [{ posisi: 'Tukang Cat', koef: 0.063, satuan: 'OH' }, { posisi: 'Pekerja', koef: 0.021, satuan: 'OH' }] },
      harga: 20625
    },
    {
      kode: 'C.4', nama: 'Rangka Atap Baja Ringan C75', satuan: 'm²', kategori: 'Atap', sumber: 'SNI',
      koefisien: { material: [{ nama: 'Baja Ringan C75', koef: 0.5, satuan: 'Batang' }, { nama: 'Reng Baja', koef: 1.2, satuan: 'Batang' }], tenaga: [{ posisi: 'Tukang Besi', koef: 0.1, satuan: 'OH' }, { posisi: 'Pekerja', koef: 0.1, satuan: 'OH' }] },
      harga: 201667
    },
    {
      kode: 'SNI-P1', nama: 'Pasang Bowplank', satuan: "m'", kategori: 'Persiapan', sumber: 'SNI',
      koefisien: { material: [{ nama: 'Kayu Kaso 5/7', koef: 0.012, satuan: 'Batang' }, { nama: 'Papan Cor', koef: 0.007, satuan: 'Lbr' }, { nama: 'Paku Campur', koef: 0.02, satuan: 'Kg' }], tenaga: [{ posisi: 'Tukang Kayu', koef: 0.1, satuan: 'OH' }, { posisi: 'Pekerja', koef: 0.1, satuan: 'OH' }] },
      harga: 171363
    },
    {
      kode: 'SNI-G1', nama: 'Plafon Gypsum Board', satuan: 'm²', kategori: 'Arsitektur', sumber: 'SNI',
      koefisien: { material: [{ nama: 'Gypsum Board', koef: 0.367, satuan: 'Lembar' }, { nama: 'Hollow 4x4', koef: 0.5, satuan: 'Batang' }, { nama: 'Hollow 2x4', koef: 0.3, satuan: 'Batang' }], tenaga: [{ posisi: 'Tukang Kayu', koef: 0.15, satuan: 'OH' }, { posisi: 'Pekerja', koef: 0.1, satuan: 'OH' }] },
      harga: 138820
    },
    {
      kode: 'SNI-B1', nama: 'Baja WF Profil WF 400x200', satuan: 'kg', kategori: 'Baja Struktural', sumber: 'SNI',
      koefisien: { material: [{ nama: 'Baja WF/H-Beam', koef: 1.05, satuan: 'Kg' }, { nama: 'Kawat Las/Elektroda', koef: 0.02, satuan: 'Kg' }, { nama: 'Cat Anti Karat/Meni Besi', koef: 0.01, satuan: 'Kg' }], tenaga: [{ posisi: 'Tukang Besi', koef: 0.05, satuan: 'OH' }, { posisi: 'Pekerja', koef: 0.05, satuan: 'OH' }] },
      harga: 132193
    },
  ];

  const insert = db.prepare(`
    INSERT INTO master_analisa (tenant_id, kode, nama, satuan, kategori, sumber, koefisien_json, harga_satuan)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  for (const item of items) {
    insert.run(tenantId, item.kode, item.nama, item.satuan, item.kategori, item.sumber, JSON.stringify(item.koefisien), item.harga);
  }
}

module.exports = { seed };
