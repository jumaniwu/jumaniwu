// ============================================================
// PropFS — Core Feasibility Study Calculation Engine
// PT. Mettaland Batam Sukses
// ============================================================

import type {
  FSInputs,
  FSResults,
  TipeBangunan,
  BiayaBangunPerFase,
  HargaJualPerFase,
  PenerimaanPerFase,
  BagiHasilResult,
  SensitivityCell,
  StatusKelayakan,
  PenjualanPerFase,
} from '../types/fs.types'
import { calcCashFlow } from './cashflow'

// ── STATUS HELPER ──────────────────────────────────────────
export function getStatusKelayakan(netMarginPct: number): StatusKelayakan {
  if (netMarginPct >= 25) return 'sangat_layak'
  if (netMarginPct >= 15) return 'layak'
  return 'tidak_layak'
}

// ── BIAYA ──────────────────────────────────────────────────

/**
 * Total biaya persiapan proyek
 * = harga beli lahan + perizinan + pengolahan + sarpras + inventaris
 */
export function calcBiayaPersiapan(inputs: FSInputs): number {
  const bp = inputs.biayaPersiapan
  let hargaLahan = bp.hargaBeliLahan

  // Jika mode per m², hitung luas × harga/m²
  if (bp.gunakanPerM2 && bp.hargaBeliLahanPerM2 && inputs.lahan.luasLahanTotal > 0) {
    hargaLahan = bp.hargaBeliLahanPerM2 * inputs.lahan.luasLahanTotal
  }

  return hargaLahan
    + bp.biayaPerizinan
    + bp.biayaPengolahanLahan
    + bp.biayaSaranadanPrasarana
    + bp.biayaInventarisProyek
}

/**
 * Total biaya operasional seluruh proyek
 * = (marketing + kantor) × durasi × jumlah fase
 */
export function calcBiayaOperasional(inputs: FSInputs): number {
  const { biayaMarketingPerBulan, biayaUmumKantorPerBulan } = inputs.biayaOperasional
  return (biayaMarketingPerBulan + biayaUmumKantorPerBulan)
    * inputs.durasiPerFase
    * inputs.jumlahFase
}

/**
 * Biaya konstruksi per unit, per tipe, per fase
 * = biaya_per_m2 × (1 + kenaikan)^(fase-1) × luas_bangunan
 * (fase dimulai dari 1)
 */
export function calcBiayaBangunPerUnit(tipe: TipeBangunan, fase: number): number {
  const multiplier = Math.pow(1 + tipe.kenaikanBiayaPerFase / 100, fase - 1)
  return tipe.biayaKonstruksiPerM2 * multiplier * tipe.luasBangunan
}

/**
 * Semua biaya bangun per tipe per fase
 */
export function calcBiayaBangunDetail(inputs: FSInputs): BiayaBangunPerFase[] {
  const result: BiayaBangunPerFase[] = []

  for (const tipe of inputs.tipeBangunan) {
    for (let fase = 1; fase <= inputs.jumlahFase; fase++) {
      const biayaPerUnit = calcBiayaBangunPerUnit(tipe, fase)

      // Unit yang dijual di fase ini (digunakan untuk biaya yang di-trigger penjualan)
      // Untuk kalkulasi investment, kita hitung SEMUA unit per tipe dibagi rata per fase
      const unitPerFase = Math.round(tipe.jumlahUnit / inputs.jumlahFase)

      result.push({
        tipeId: tipe.id,
        fase,
        biayaPerUnit,
        totalUnit: unitPerFase,
        totalBiaya: biayaPerUnit * unitPerFase,
      })
    }
  }

  return result
}

/**
 * Total biaya konstruksi bangunan seluruh proyek
 * Dihitung berdasarkan unit yang dijual di setiap fase (biaya follow penjualan)
 */
export function calcTotalBiayaBangun(inputs: FSInputs): number {
  let total = 0
  for (const tipe of inputs.tipeBangunan) {
    for (let fase = 1; fase <= inputs.jumlahFase; fase++) {
      const biayaPerUnit = calcBiayaBangunPerUnit(tipe, fase)
      // Unit yang terjual di fase ini
      const unitTerjual = getUnitTerjual(inputs.penjualan, tipe.id, fase)
      total += biayaPerUnit * unitTerjual
    }
  }
  return total
}

function getUnitTerjual(penjualan: PenjualanPerFase[], tipeId: string, fase: number): number {
  const found = penjualan.find(p => p.tipeId === tipeId && p.fase === fase)
  return found?.unitTerjual ?? 0
}

/**
 * Total investment keseluruhan proyek
 */
export function calcTotalInvestment(
  totalBiayaPersiapan: number,
  totalBiayaOperasional: number,
  totalBiayaBangun: number,
): number {
  return totalBiayaPersiapan + totalBiayaOperasional + totalBiayaBangun
}

// ── HARGA JUAL ─────────────────────────────────────────────

/**
 * Biaya persiapan per m² kavling
 * = Total Biaya Persiapan / Total Luas Kavling Efektif
 */
export function calcBiayaPersiapanPerM2(inputs: FSInputs, totalBiayaPersiapan: number): number {
  const totalLuasKavling = inputs.tipeBangunan.reduce(
    (sum, t) => sum + t.luasKavling * t.jumlahUnit, 0
  )
  if (totalLuasKavling <= 0) return 0
  return totalBiayaPersiapan / totalLuasKavling
}

/**
 * Biaya operasional per m² kavling
 */
export function calcBiayaOpsPerM2(inputs: FSInputs, totalBiayaOps: number): number {
  const totalLuasKavling = inputs.tipeBangunan.reduce(
    (sum, t) => sum + t.luasKavling * t.jumlahUnit, 0
  )
  if (totalLuasKavling <= 0) return 0
  return totalBiayaOps / totalLuasKavling
}

/**
 * Harga jual bangunan per unit, per fase
 * = (biaya_pokok_per_m2 + margin_per_m2) × kelipatan × luas_bangunan
 */
export function calcHargaJualBangunan(tipe: TipeBangunan, fase: number): number {
  const biayaPokok = calcBiayaBangunPerUnit(tipe, fase) / tipe.luasBangunan
  return (biayaPokok + tipe.marginBangunanPerM2) * tipe.kelipatanMarginBangunan * tipe.luasBangunan
}

/**
 * Harga jual kavling per unit
 * = (biaya_persiapan_m2 + biaya_ops_m2 + margin_m2) × kelipatan × luas_kavling
 */
export function calcHargaJualKavling(
  tipe: TipeBangunan,
  biayaPersiapanPerM2: number,
  biayaOpsPerM2: number,
): number {
  return (biayaPersiapanPerM2 + biayaOpsPerM2 + tipe.marginKavlingPerM2)
    * tipe.kelipatanMarginKavling
    * tipe.luasKavling
}

/**
 * Semua harga jual per tipe per fase
 */
export function calcHargaJualDetail(
  inputs: FSInputs,
  biayaPersiapanPerM2: number,
  biayaOpsPerM2: number,
): HargaJualPerFase[] {
  const result: HargaJualPerFase[] = []

  for (const tipe of inputs.tipeBangunan) {
    for (let fase = 1; fase <= inputs.jumlahFase; fase++) {
      const hargaBangunan = calcHargaJualBangunan(tipe, fase)
      const hargaKavling  = calcHargaJualKavling(tipe, biayaPersiapanPerM2, biayaOpsPerM2)

      result.push({
        tipeId: tipe.id,
        fase,
        hargaBangunan,
        hargaKavling,
        hargaTotal: hargaBangunan + hargaKavling,
      })
    }
  }

  return result
}

// ── REVENUE ────────────────────────────────────────────────

/**
 * Rincian penerimaan per tipe per fase
 */
export function calcPenerimaanDetail(
  inputs: FSInputs,
  hargaJualPerFase: HargaJualPerFase[],
): PenerimaanPerFase[] {
  const result: PenerimaanPerFase[] = []

  for (const tipe of inputs.tipeBangunan) {
    for (let fase = 1; fase <= inputs.jumlahFase; fase++) {
      const unitTerjual = getUnitTerjual(inputs.penjualan, tipe.id, fase)
      const harga = hargaJualPerFase.find(
        h => h.tipeId === tipe.id && h.fase === fase
      )
      const hargaPerUnit = harga?.hargaTotal ?? 0

      result.push({
        fase,
        tipeId: tipe.id,
        unitTerjual,
        hargaPerUnit,
        totalPenerimaan: unitTerjual * hargaPerUnit,
      })
    }
  }

  return result
}

/**
 * Total Gross Revenue = Σ (unit_terjual × harga_per_unit) semua tipe × fase
 */
export function calcGrossRevenue(penerimaanDetail: PenerimaanPerFase[]): number {
  return penerimaanDetail.reduce((sum, p) => sum + p.totalPenerimaan, 0)
}

// ── PROFIT ─────────────────────────────────────────────────

export function calcGrossProfit(grossRevenue: number, totalInvestment: number): number {
  return grossRevenue - totalInvestment
}

export function calcGrossMargin(grossProfit: number, grossRevenue: number): number {
  if (grossRevenue <= 0) return 0
  return (grossProfit / grossRevenue) * 100
}

/**
 * Kalkulasi bunga pinjaman
 */
export function calcTotalRiba(inputs: FSInputs): number {
  const pinjaman = inputs.potongan.riba
  if (!pinjaman || pinjaman.pokokPinjaman <= 0) return 0

  const { pokokPinjaman, bungaPerTahun, periodeBulan, metode } = pinjaman
  const bungaPerBulan = bungaPerTahun / 12 / 100

  if (metode === 'flat') {
    return pokokPinjaman * bungaPerBulan * periodeBulan
  }

  if (metode === 'efektif' || metode === 'anuitas') {
    if (bungaPerBulan <= 0) return pokokPinjaman
    // Annuitas / efektif menggunakan formula anuitas standar
    const angsuran = pokokPinjaman * bungaPerBulan /
      (1 - Math.pow(1 + bungaPerBulan, -periodeBulan))
    return (angsuran * periodeBulan) - pokokPinjaman
  }

  return 0
}

/**
 * Total semua potongan
 * PPh + Riba + Fee Marketing + Bonus + CSR
 * (catatan: Bagi Hasil tidak masuk potongan, dihitung terpisah)
 */
export function calcTotalPotongan(inputs: FSInputs, grossRevenue: number): {
  pphFinal: number
  totalRiba: number
  feeMarketing: number
  bonusTutupTahun: number
  csr: number
  total: number
} {
  const { potongan } = inputs
  const pphFinal        = grossRevenue * (potongan.pphFinal / 100)
  const feeMarketing    = grossRevenue * (potongan.feePenjualanLangsung / 100)
  const bonusTutupTahun = grossRevenue * (potongan.bonusTutupTahun / 100)
  const totalRiba       = calcTotalRiba(inputs)
  const csr             = potongan.csrDanLainLain

  return {
    pphFinal,
    totalRiba,
    feeMarketing,
    bonusTutupTahun,
    csr,
    total: pphFinal + feeMarketing + bonusTutupTahun + totalRiba + csr,
  }
}

export function calcNetProfit(grossProfit: number, totalPotongan: number): number {
  return grossProfit - totalPotongan
}

export function calcNetMargin(netProfit: number, grossRevenue: number): number {
  if (grossRevenue <= 0) return 0
  return (netProfit / grossRevenue) * 100
}

// ── BAGI HASIL ─────────────────────────────────────────────

/**
 * Bagi hasil dihitung dari Gross Revenue (bukan net profit)
 * Sesuai note di spesifikasi
 */
export function calcBagiHasil(
  grossRevenue: number,
  grossProfit: number,
  totalPotongan: number,
  pctPemilik: number,
  skenarioId: 'A' | 'B' | 'C',
): BagiHasilResult {
  const nilaiPemilik    = grossRevenue * (pctPemilik / 100)
  const netDevProfit    = grossProfit - totalPotongan - nilaiPemilik
  const netDevMargin    = grossRevenue > 0 ? (netDevProfit / grossRevenue) * 100 : 0
  const nilaiDeveloper  = grossRevenue - nilaiPemilik

  return {
    skenarioId,
    pctPemilik,
    nilaiPemilik,
    nilaiDeveloper,
    netDevProfit,
    netDevMargin,
    status: getStatusKelayakan(netDevMargin),
  }
}

/**
 * Harga jual minimum agar developer dapat target margin
 */
export function calcMinHargaJual(
  totalInvestment: number,
  totalUnit: number,
  pctPemilik: number,
  pctPotongan: number,
  targetMargin: number,
): number {
  if (totalUnit <= 0) return 0
  // GR_min × (1 - pctPemilik/100 - pctPotongan/100 - targetMargin/100) = totalInvestment
  const faktor = 1 - (pctPemilik / 100) - (pctPotongan / 100) - (targetMargin / 100)
  if (faktor <= 0) return Infinity
  const grMin = totalInvestment / faktor
  return grMin / totalUnit
}

// ── SENSITIVITAS ────────────────────────────────────────────

const SENSITIVITY_CHANGES = [-20, -10, 0, 10, 20]

export function calcSensitivityMatrix(
  baseGrossRevenue: number,
  baseTotalCost: number,
): SensitivityCell[][] {
  return SENSITIVITY_CHANGES.map(biayaChange =>
    SENSITIVITY_CHANGES.map(revenueChange => {
      const adjRevenue = baseGrossRevenue * (1 + revenueChange / 100)
      const adjCost    = baseTotalCost    * (1 + biayaChange / 100)
      const netProfit  = adjRevenue - adjCost
      const netMargin  = adjRevenue > 0 ? (netProfit / adjRevenue) * 100 : -100

      return {
        biayaChange,
        revenueChange,
        netMargin,
        status: getStatusKelayakan(netMargin),
      }
    })
  )
}

// ── MAIN CALCULATOR ────────────────────────────────────────

/**
 * Master function: menghitung semua angka FS dari inputs
 */
export function calculateFS(inputs: FSInputs): FSResults {
  // 1. Biaya
  const totalBiayaPersiapan    = calcBiayaPersiapan(inputs)
  const totalBiayaOperasional  = calcBiayaOperasional(inputs)
  const totalBiayaBangun       = calcTotalBiayaBangun(inputs)
  const totalInvestment        = calcTotalInvestment(
    totalBiayaPersiapan,
    totalBiayaOperasional,
    totalBiayaBangun,
  )

  // 2. Per m² helpers
  const biayaPersiapanPerM2 = calcBiayaPersiapanPerM2(inputs, totalBiayaPersiapan)
  const biayaOpsPerM2       = calcBiayaOpsPerM2(inputs, totalBiayaOperasional)

  // 3. Harga jual
  const hargaJualPerFase = calcHargaJualDetail(inputs, biayaPersiapanPerM2, biayaOpsPerM2)

  // 4. Biaya bangun detail (untuk display)
  const biayaBangunPerFase = calcBiayaBangunDetail(inputs)

  // 5. Revenue
  const penerimaanPerFase = calcPenerimaanDetail(inputs, hargaJualPerFase)
  const grossRevenue      = calcGrossRevenue(penerimaanPerFase)

  // 6. Profit
  const grossProfit  = calcGrossProfit(grossRevenue, totalInvestment)
  const grossMargin  = calcGrossMargin(grossProfit, grossRevenue)

  // 7. Potongan
  const potonganDetail = calcTotalPotongan(inputs, grossRevenue)

  // 8. Net
  const netProfit  = calcNetProfit(grossProfit, potonganDetail.total)
  const netMargin  = calcNetMargin(netProfit, grossRevenue)
  const status     = getStatusKelayakan(netMargin)

  // 9. Bagi hasil
  const bagiHasil: BagiHasilResult[] = inputs.potongan.skenarioBagiHasil.map(sk =>
    calcBagiHasil(grossRevenue, grossProfit, potonganDetail.total, sk.pctPemilik, sk.id)
  )

  // 10. Cash flow
  const cashFlow = calcCashFlow(inputs, hargaJualPerFase)

  // 11. Sensitivitas
  const sensitivityMatrix = calcSensitivityMatrix(grossRevenue, totalInvestment)

  // 12. Per-unit stats
  const totalUnit = inputs.tipeBangunan.reduce((s, t) => s + t.jumlahUnit, 0)
  const unitTerjualTotal = inputs.penjualan.reduce((s, p) => s + p.unitTerjual, 0)
  const rataHargaPerUnit = unitTerjualTotal > 0 ? grossRevenue / unitTerjualTotal : 0
  const hppPerUnit       = unitTerjualTotal > 0 ? totalInvestment / unitTerjualTotal : 0
  const totalLuasKavling = inputs.tipeBangunan.reduce((s, t) => s + t.luasKavling * t.jumlahUnit, 0)
  const revenuePerM2     = totalLuasKavling > 0 ? grossRevenue / totalLuasKavling : 0

  return {
    totalBiayaPersiapan,
    totalBiayaOperasional,
    totalBiayaBangun,
    totalInvestment,

    grossRevenue,
    hargaJualPerFase,
    penerimaanPerFase,
    biayaBangunPerFase,

    grossProfit,
    grossMargin,

    pphFinal:          potonganDetail.pphFinal,
    totalRiba:         potonganDetail.totalRiba,
    feeMarketing:      potonganDetail.feeMarketing,
    bonusTutupTahun:   potonganDetail.bonusTutupTahun,
    csr:               potonganDetail.csr,
    totalPotongan:     potonganDetail.total,

    netProfit,
    netMargin,
    statusKelayakan:   status,

    bagiHasil,
    cashFlow,
    sensitivityMatrix,

    rataHargaPerUnit,
    hppPerUnit,
    revenuePerM2,
    totalUnit,
    biayaPersiapanPerM2,
    biayaOpsPerM2,
  }
}
