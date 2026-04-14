// ============================================================
// PropFS — TypeScript Types & Interfaces
// PT. Mettaland Batam Sukses
// ============================================================

export type JenisProyek = 'perumahan' | 'ruko' | 'mixed'
export type StatusKelayakan = 'sangat_layak' | 'layak' | 'tidak_layak'
export type MetodeBunga = 'flat' | 'anuitas' | 'efektif'

// ── TIPE BANGUNAN ──────────────────────────────────────────
export interface TipeBangunan {
  id: string
  nama: string
  luasBangunan: number     // m²
  luasKavling: number      // m²
  jumlahUnit: number
  // Biaya per tipe (Step 4)
  biayaKonstruksiPerM2: number
  kenaikanBiayaPerFase: number  // %, default 5
  // Harga jual (Step 5)
  marginBangunanPerM2: number
  kelipatanMarginBangunan: number
  marginKavlingPerM2: number
  kelipatanMarginKavling: number
}

// ── DATA LAHAN ─────────────────────────────────────────────
export interface DataLahan {
  luasLahanTotal: number       // m²
  pctLahanEfektif: number      // %, default 50
  // Auto-calculated:
  luasEfektif?: number         // luasTotal × pct
  luasFasilitasUmum?: number   // luasTotal - luasEfektif
}

// ── BIAYA PERSIAPAN ────────────────────────────────────────
export interface BiayaPersiapan {
  hargaBeliLahan: number           // Rp total (atau per m² × luas)
  hargaBeliLahanPerM2?: number     // opsional, auto-calc jika diisi
  gunakanPerM2: boolean
  biayaPerizinan: number
  biayaPengolahanLahan: number
  biayaSaranadanPrasarana: number
  biayaInventarisProyek: number
}

// ── BIAYA OPERASIONAL ──────────────────────────────────────
export interface BiayaOperasional {
  biayaMarketingPerBulan: number
  biayaUmumKantorPerBulan: number
}

// ── PINJAMAN ──────────────────────────────────────────────
export interface DataPinjaman {
  pokokPinjaman: number
  bungaPerTahun: number   // %
  periodeBulan: number
  metode: MetodeBunga
}

// ── BAGI HASIL ─────────────────────────────────────────────
export interface SkenarioBagiHasil {
  id: 'A' | 'B' | 'C'
  label: string
  pctPemilik: number   // % ke pemilik lahan dari Gross Revenue
}

// ── POTONGAN ──────────────────────────────────────────────
export interface DataPotongan {
  pphFinal: number              // %, default 2.5
  riba?: DataPinjaman
  feePenjualanLangsung: number  // %, default 5
  bonusTutupTahun: number       // %, default 2.5
  skenarioBagiHasil: SkenarioBagiHasil[]
  csrDanLainLain: number        // Rp lump sum
}

// ── SIMULASI PENJUALAN ─────────────────────────────────────
export interface PenjualanPerFase {
  tipeId: string
  fase: number
  unitTerjual: number
}

// ── INPUT LENGKAP FS ──────────────────────────────────────
export interface FSInputs {
  // Step 1
  namaProyek: string
  alamatLokasi: string
  namaDeveloper: string
  tahunMulai: number
  jumlahFase: number         // 1-6, default 3
  durasiPerFase: number      // bulan, default 24
  jenisProyek: JenisProyek
  logoUrl?: string           // base64 atau url

  // Step 2
  lahan: DataLahan

  // Step 3
  tipeBangunan: TipeBangunan[]

  // Step 4
  biayaPersiapan: BiayaPersiapan
  biayaOperasional: BiayaOperasional

  // Step 5 — harga jual di-embed dalam TipeBangunan (margin fields)

  // Step 6
  penjualan: PenjualanPerFase[]

  // Step 7
  potongan: DataPotongan
}

// ── OUTPUT / RESULTS ───────────────────────────────────────

export interface HargaJualPerFase {
  tipeId: string
  fase: number
  hargaBangunan: number
  hargaKavling: number
  hargaTotal: number
}

export interface BiayaBangunPerFase {
  tipeId: string
  fase: number
  biayaPerUnit: number
  totalUnit: number
  totalBiaya: number
}

export interface PenerimaanPerFase {
  fase: number
  tipeId: string
  unitTerjual: number
  hargaPerUnit: number
  totalPenerimaan: number
}

export interface BagiHasilResult {
  skenarioId: 'A' | 'B' | 'C'
  pctPemilik: number
  nilaiPemilik: number
  nilaiDeveloper: number
  netDevProfit: number
  netDevMargin: number
  status: StatusKelayakan
}

export interface CashFlowPeriode {
  periode: number          // 1-based (bulan atau quarter)
  label: string            // "Q1 F1", "Bulan 1", dll
  penerimaan: number
  biayaBangun: number
  biayaPersiapan: number
  biayaOperasional: number
  netCF: number
  kumulatif: number
}

export interface CashFlowResult {
  monthly: CashFlowPeriode[]
  quarterly: CashFlowPeriode[]
  annual: CashFlowPeriode[]
  breakevenBulan: number | null
  breakevenQuarter: number | null
  peakNegativeCF: number
  totalCashIn: number
  totalCashOut: number
}

export interface SensitivityCell {
  biayaChange: number    // %
  revenueChange: number  // %
  netMargin: number      // %
  status: StatusKelayakan
}

export interface FSResults {
  // Biaya
  totalBiayaPersiapan: number
  totalBiayaOperasional: number
  totalBiayaBangun: number
  totalInvestment: number

  // Revenue
  grossRevenue: number
  hargaJualPerFase: HargaJualPerFase[]
  penerimaanPerFase: PenerimaanPerFase[]
  biayaBangunPerFase: BiayaBangunPerFase[]

  // Profit
  grossProfit: number
  grossMargin: number

  // Potongan
  pphFinal: number
  totalRiba: number
  feeMarketing: number
  bonusTutupTahun: number
  csr: number
  totalPotongan: number

  // Net
  netProfit: number
  netMargin: number
  statusKelayakan: StatusKelayakan

  // Bagi hasil
  bagiHasil: BagiHasilResult[]

  // Cash flow
  cashFlow: CashFlowResult

  // Sensitivitas
  sensitivityMatrix: SensitivityCell[][]

  // Per unit stats
  rataHargaPerUnit: number
  hppPerUnit: number
  revenuePerM2: number
  totalUnit: number

  // Biaya per m²
  biayaPersiapanPerM2: number
  biayaOpsPerM2: number
}

// ── SAVED PROJECT ──────────────────────────────────────────
export interface SavedProject {
  id: string
  createdAt: string
  updatedAt: string
  name: string
  inputs: FSInputs
  results: FSResults | null
  version: string
}

// ── DEFAULT VALUES ─────────────────────────────────────────
export const DEFAULT_TIPE: Omit<TipeBangunan, 'id'> = {
  nama: '',
  luasBangunan: 0,
  luasKavling: 0,
  jumlahUnit: 0,
  biayaKonstruksiPerM2: 6000000,
  kenaikanBiayaPerFase: 5,
  marginBangunanPerM2: 2000000,
  kelipatanMarginBangunan: 5,
  marginKavlingPerM2: 1000000,
  kelipatanMarginKavling: 5,
}

export const DEFAULT_INPUTS: FSInputs = {
  namaProyek: '',
  alamatLokasi: '',
  namaDeveloper: 'PT. Mettaland Batam Sukses',
  tahunMulai: new Date().getFullYear(),
  jumlahFase: 3,
  durasiPerFase: 24,
  jenisProyek: 'perumahan',
  lahan: {
    luasLahanTotal: 0,
    pctLahanEfektif: 50,
  },
  tipeBangunan: [],
  biayaPersiapan: {
    hargaBeliLahan: 0,
    gunakanPerM2: false,
    biayaPerizinan: 0,
    biayaPengolahanLahan: 0,
    biayaSaranadanPrasarana: 0,
    biayaInventarisProyek: 0,
  },
  biayaOperasional: {
    biayaMarketingPerBulan: 0,
    biayaUmumKantorPerBulan: 0,
  },
  penjualan: [],
  potongan: {
    pphFinal: 2.5,
    feePenjualanLangsung: 5,
    bonusTutupTahun: 2.5,
    csrDanLainLain: 0,
    skenarioBagiHasil: [
      { id: 'A', label: 'Skenario A', pctPemilik: 25 },
      { id: 'B', label: 'Skenario B', pctPemilik: 30 },
      { id: 'C', label: 'Skenario C', pctPemilik: 35 },
    ],
  },
}

// ── TEMPLATE DATA ──────────────────────────────────────────
export const TEMPLATE_A: Partial<FSInputs> = {
  namaProyek: 'King Square - Bodhi Dharma',
  alamatLokasi: 'Batam Centre, Kepulauan Riau',
  namaDeveloper: 'PT. Mettaland Batam Sukses',
  tahunMulai: 2024,
  jumlahFase: 3,
  durasiPerFase: 24,
  jenisProyek: 'perumahan',
  lahan: {
    luasLahanTotal: 130000,
    pctLahanEfektif: 50,
  },
  tipeBangunan: [
    { id: 't1', nama: 'TIPE 235/85',  luasBangunan: 235, luasKavling: 85,  jumlahUnit: 242, biayaKonstruksiPerM2: 3500000, kenaikanBiayaPerFase: 5, marginBangunanPerM2: 2000000, kelipatanMarginBangunan: 5, marginKavlingPerM2: 1000000, kelipatanMarginKavling: 5 },
    { id: 't2', nama: 'TIPE 90/90',   luasBangunan: 90,  luasKavling: 90,  jumlahUnit: 150, biayaKonstruksiPerM2: 6000000, kenaikanBiayaPerFase: 5, marginBangunanPerM2: 2000000, kelipatanMarginBangunan: 5, marginKavlingPerM2: 1000000, kelipatanMarginKavling: 5 },
    { id: 't3', nama: 'TIPE 120/105', luasBangunan: 120, luasKavling: 105, jumlahUnit: 120, biayaKonstruksiPerM2: 6000000, kenaikanBiayaPerFase: 5, marginBangunanPerM2: 2000000, kelipatanMarginBangunan: 5, marginKavlingPerM2: 1000000, kelipatanMarginKavling: 5 },
    { id: 't4', nama: 'TIPE 180/128', luasBangunan: 180, luasKavling: 128, jumlahUnit: 50,  biayaKonstruksiPerM2: 6000000, kenaikanBiayaPerFase: 5, marginBangunanPerM2: 2000000, kelipatanMarginBangunan: 5, marginKavlingPerM2: 1000000, kelipatanMarginKavling: 5 },
    { id: 't5', nama: 'TIPE 250/200', luasBangunan: 250, luasKavling: 200, jumlahUnit: 40,  biayaKonstruksiPerM2: 6000000, kenaikanBiayaPerFase: 5, marginBangunanPerM2: 2000000, kelipatanMarginBangunan: 5, marginKavlingPerM2: 1000000, kelipatanMarginKavling: 5 },
  ],
  biayaPersiapan: {
    hargaBeliLahan: 78000000000,
    gunakanPerM2: false,
    biayaPerizinan: 0,
    biayaPengolahanLahan: 0,
    biayaSaranadanPrasarana: 0,
    biayaInventarisProyek: 0,
  },
  biayaOperasional: {
    biayaMarketingPerBulan: 63000000,
    biayaUmumKantorPerBulan: 63000000,
  },
  potongan: {
    pphFinal: 2.5,
    feePenjualanLangsung: 5,
    bonusTutupTahun: 2.5,
    csrDanLainLain: 0,
    skenarioBagiHasil: [
      { id: 'A', label: 'Skenario A', pctPemilik: 25 },
      { id: 'B', label: 'Skenario B', pctPemilik: 30 },
      { id: 'C', label: 'Skenario C', pctPemilik: 35 },
    ],
  },
}

export const TEMPLATE_B: Partial<FSInputs> = {
  namaProyek: 'Ruko Komersial 2LT — Batam Centre',
  alamatLokasi: 'Batam Centre, ROW 70m',
  namaDeveloper: 'PT. KIS Batam Centre',
  tahunMulai: 2024,
  jumlahFase: 1,
  durasiPerFase: 12,
  jenisProyek: 'ruko',
  lahan: {
    luasLahanTotal: 5500,
    pctLahanEfektif: 70,
  },
  tipeBangunan: [
    { id: 'r1', nama: 'Standard',  luasBangunan: 140, luasKavling: 133, jumlahUnit: 19, biayaKonstruksiPerM2: 3800000, kenaikanBiayaPerFase: 0, marginBangunanPerM2: 2500000, kelipatanMarginBangunan: 1, marginKavlingPerM2: 2000000, kelipatanMarginKavling: 1 },
    { id: 'r2', nama: 'Corner',    luasBangunan: 140, luasKavling: 133, jumlahUnit: 8,  biayaKonstruksiPerM2: 3800000, kenaikanBiayaPerFase: 0, marginBangunanPerM2: 3500000, kelipatanMarginBangunan: 1, marginKavlingPerM2: 2000000, kelipatanMarginKavling: 1 },
    { id: 'r3', nama: 'End Unit',  luasBangunan: 140, luasKavling: 133, jumlahUnit: 4,  biayaKonstruksiPerM2: 3800000, kenaikanBiayaPerFase: 0, marginBangunanPerM2: 3000000, kelipatanMarginBangunan: 1, marginKavlingPerM2: 2000000, kelipatanMarginKavling: 1 },
  ],
  biayaPersiapan: {
    hargaBeliLahan: 0,
    gunakanPerM2: false,
    biayaPerizinan: 500000000,
    biayaPengolahanLahan: 200000000,
    biayaSaranadanPrasarana: 1000000000,
    biayaInventarisProyek: 100000000,
  },
  biayaOperasional: {
    biayaMarketingPerBulan: 30000000,
    biayaUmumKantorPerBulan: 20000000,
  },
  potongan: {
    pphFinal: 2.5,
    feePenjualanLangsung: 3,
    bonusTutupTahun: 1,
    csrDanLainLain: 0,
    skenarioBagiHasil: [
      { id: 'A', label: 'Skenario A', pctPemilik: 20 },
      { id: 'B', label: 'Skenario B', pctPemilik: 25 },
      { id: 'C', label: 'Skenario C', pctPemilik: 30 },
    ],
  },
}
