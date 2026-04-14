// ============================================================
// PropFS — Cash Flow Projection Engine
// ============================================================

import type {
  FSInputs,
  CashFlowPeriode,
  CashFlowResult,
  HargaJualPerFase,
} from '../types/fs.types'
import { calcBiayaBangunPerUnit } from './calculator'

/**
 * Distribusikan nilai ke array periodik
 * Membantu spread biaya/revenue ke periode tertentu
 */
function spread(total: number, periods: number, startIdx = 0, arr: number[]): void {
  const perPeriod = Math.floor(total / periods)
  const remainder = total - perPeriod * periods
  for (let i = 0; i < periods; i++) {
    arr[startIdx + i] = (arr[startIdx + i] ?? 0) + perPeriod + (i === 0 ? remainder : 0)
  }
}

/**
 * Generate monthly cash flow data
 */
export function calcCashFlow(
  inputs: FSInputs,
  hargaJualPerFase: HargaJualPerFase[],
): CashFlowResult {
  const totalBulan = inputs.jumlahFase * inputs.durasiPerFase

  // Arrays per bulan
  const penerimaanArr   = new Array<number>(totalBulan).fill(0)
  const biayaBangunArr  = new Array<number>(totalBulan).fill(0)
  const biayaPersiapanArr = new Array<number>(totalBulan).fill(0)
  const biayaOpsArr     = new Array<number>(totalBulan).fill(0)

  // ── Biaya Persiapan: spread di bulan 1-6 awal proyek
  const { biayaPersiapan: bp } = inputs
  let totalBP = bp.hargaBeliLahan
  if (bp.gunakanPerM2 && bp.hargaBeliLahanPerM2) {
    totalBP = bp.hargaBeliLahanPerM2 * inputs.lahan.luasLahanTotal
  }
  totalBP += bp.biayaPerizinan + bp.biayaPengolahanLahan + bp.biayaSaranadanPrasarana + bp.biayaInventarisProyek
  const persiapanSpread = Math.min(6, totalBulan)
  spread(totalBP, persiapanSpread, 0, biayaPersiapanArr)

  // ── Biaya Operasional: flat per bulan sepanjang proyek
  const biayaOpsPerBulan =
    inputs.biayaOperasional.biayaMarketingPerBulan +
    inputs.biayaOperasional.biayaUmumKantorPerBulan
  for (let i = 0; i < totalBulan; i++) {
    biayaOpsArr[i] = biayaOpsPerBulan
  }

  // ── Per fase: biaya bangun & penerimaan
  for (let fase = 1; fase <= inputs.jumlahFase; fase++) {
    const faseStartBulan = (fase - 1) * inputs.durasiPerFase  // 0-based index

    for (const tipe of inputs.tipeBangunan) {
      const penjualanFase = inputs.penjualan.find(
        p => p.tipeId === tipe.id && p.fase === fase,
      )
      const unitTerjual = penjualanFase?.unitTerjual ?? 0
      if (unitTerjual === 0) continue

      // Biaya bangun: spread sepanjang durasi fase
      const biayaPerUnit = calcBiayaBangunPerUnit(tipe, fase)
      const totalBiayaTipe = biayaPerUnit * unitTerjual
      spread(totalBiayaTipe, inputs.durasiPerFase, faseStartBulan, biayaBangunArr)

      // Penerimaan: tersebar dari pertengahan fase sampai akhir fase
      // (simulasi: pembeli bayar bertahap dari serah terima)
      const hargaJual = hargaJualPerFase.find(
        h => h.tipeId === tipe.id && h.fase === fase,
      )
      const hargaTotal = hargaJual?.hargaTotal ?? 0
      const totalPenerimaan = hargaTotal * unitTerjual

      // Spread penerimaan di paruh kedua fase
      const halfDurasi = Math.ceil(inputs.durasiPerFase / 2)
      const penerimaanStart = faseStartBulan + Math.floor(inputs.durasiPerFase / 2)
      spread(totalPenerimaan, halfDurasi, penerimaanStart, penerimaanArr)
    }
  }

  // ── Build monthly periods
  const monthly: CashFlowPeriode[] = []
  let kumulatif = 0
  let breakevenBulan: number | null = null
  let peakNegative = 0

  for (let i = 0; i < totalBulan; i++) {
    const fase = Math.floor(i / inputs.durasiPerFase) + 1
    const bulanDalamFase = (i % inputs.durasiPerFase) + 1
    const net = penerimaanArr[i]
      - biayaBangunArr[i]
      - biayaPersiapanArr[i]
      - biayaOpsArr[i]
    kumulatif += net

    if (kumulatif < peakNegative) peakNegative = kumulatif

    if (breakevenBulan === null && kumulatif >= 0 && i > 0) {
      breakevenBulan = i + 1  // 1-based
    }

    monthly.push({
      periode: i + 1,
      label: `B${bulanDalamFase} F${fase}`,
      penerimaan:       penerimaanArr[i],
      biayaBangun:      biayaBangunArr[i],
      biayaPersiapan:   biayaPersiapanArr[i],
      biayaOperasional: biayaOpsArr[i],
      netCF:            net,
      kumulatif,
    })
  }

  // ── Aggregate ke quarterly
  const quarterly: CashFlowPeriode[] = aggregatePeriods(monthly, 3, 'Q')

  // ── Aggregate ke annual
  const annual: CashFlowPeriode[] = aggregatePeriods(monthly, 12, 'T')

  // Breakeven quarter
  let breakevenQuarter: number | null = null
  if (breakevenBulan !== null) {
    breakevenQuarter = Math.ceil(breakevenBulan / 3)
  }

  const totalCashIn  = monthly.reduce((s, p) => s + p.penerimaan, 0)
  const totalCashOut = monthly.reduce(
    (s, p) => s + p.biayaBangun + p.biayaPersiapan + p.biayaOperasional, 0
  )

  return {
    monthly,
    quarterly,
    annual,
    breakevenBulan,
    breakevenQuarter,
    peakNegativeCF: peakNegative,
    totalCashIn,
    totalCashOut,
  }
}

/**
 * Gabungkan monthly periods menjadi quarterly atau annual
 */
function aggregatePeriods(
  monthly: CashFlowPeriode[],
  groupSize: number,
  prefix: string,
): CashFlowPeriode[] {
  const result: CashFlowPeriode[] = []
  let kumulatif = 0

  for (let i = 0; i < monthly.length; i += groupSize) {
    const group = monthly.slice(i, i + groupSize)
    const periodIdx = Math.floor(i / groupSize) + 1

    const penerimaan       = group.reduce((s, p) => s + p.penerimaan, 0)
    const biayaBangun      = group.reduce((s, p) => s + p.biayaBangun, 0)
    const biayaPersiapan   = group.reduce((s, p) => s + p.biayaPersiapan, 0)
    const biayaOperasional = group.reduce((s, p) => s + p.biayaOperasional, 0)
    const netCF            = penerimaan - biayaBangun - biayaPersiapan - biayaOperasional
    kumulatif += netCF

    result.push({
      periode: periodIdx,
      label: `${prefix}${periodIdx}`,
      penerimaan,
      biayaBangun,
      biayaPersiapan,
      biayaOperasional,
      netCF,
      kumulatif,
    })
  }

  return result
}
