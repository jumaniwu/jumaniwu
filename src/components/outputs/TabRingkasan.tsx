import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, ReferenceLine,
} from 'recharts'
import { formatRupiah, formatPct } from '@/engine/formatter'
import type { FSResults } from '@/types/fs.types'

interface Props {
  results: FSResults
}

export default function TabRingkasan({ results: r }: Props) {
  // Waterfall data
  const waterfallData = [
    { name: 'Gross Revenue',    value: r.grossRevenue,        cumulative: r.grossRevenue,    type: 'base' },
    { name: 'Biaya Persiapan', value: -r.totalBiayaPersiapan, cumulative: r.grossRevenue - r.totalBiayaPersiapan, type: 'cost' },
    { name: 'Biaya Ops',       value: -r.totalBiayaOperasional, cumulative: r.grossRevenue - r.totalBiayaPersiapan - r.totalBiayaOperasional, type: 'cost' },
    { name: 'Biaya Bangun',    value: -r.totalBiayaBangun,    cumulative: r.grossProfit,     type: 'cost' },
    { name: 'Gross Profit',    value: r.grossProfit,          cumulative: r.grossProfit,     type: 'profit' },
    { name: 'Potongan',        value: -r.totalPotongan,       cumulative: r.netProfit,       type: 'cut' },
    { name: 'Net Profit',      value: r.netProfit,            cumulative: r.netProfit,       type: 'net' },
  ]

  const waterfallColor = (type: string) => {
    switch (type) {
      case 'base':   return '#0D47A1'
      case 'cost':   return '#B71C1C'
      case 'profit': return '#2E7D32'
      case 'cut':    return '#E65100'
      case 'net':    return '#1B5E20'
      default:       return '#888'
    }
  }

  const rows = [
    { label: 'Gross Revenue',         value: r.grossRevenue,         pct: 100,                                          type: 'revenue' },
    { label: '  Biaya Persiapan',     value: -r.totalBiayaPersiapan, pct: r.totalBiayaPersiapan / r.grossRevenue * 100, type: 'cost' },
    { label: '  Biaya Operasional',   value: -r.totalBiayaOperasional,pct: r.totalBiayaOperasional / r.grossRevenue * 100,type: 'cost' },
    { label: '  Biaya Bangunan',      value: -r.totalBiayaBangun,    pct: r.totalBiayaBangun / r.grossRevenue * 100,    type: 'cost' },
    { label: 'Gross Profit',          value: r.grossProfit,          pct: r.grossMargin,                                type: 'profit' },
    { label: '  PPh Final',           value: -r.pphFinal,            pct: r.pphFinal / r.grossRevenue * 100,            type: 'cut' },
    { label: '  Fee Marketing',       value: -(r.feeMarketing + r.bonusTutupTahun), pct: (r.feeMarketing + r.bonusTutupTahun) / r.grossRevenue * 100, type: 'cut' },
    { label: '  Bunga Pinjaman',      value: -r.totalRiba,           pct: r.totalRiba / r.grossRevenue * 100,           type: 'cut' },
    { label: '  CSR & Lain-lain',     value: -r.csr,                 pct: r.csr / r.grossRevenue * 100,                 type: 'cut' },
    { label: 'Net Profit (sebelum bagi hasil)', value: r.netProfit,  pct: r.netMargin,                                  type: 'net' },
  ]

  const typeClass = (type: string) => {
    switch (type) {
      case 'revenue': return 'font-bold text-blue-700 bg-blue-50/50'
      case 'cost':    return 'text-red-700'
      case 'profit':  return 'font-bold text-emerald-700 bg-emerald-50/50'
      case 'cut':     return 'text-orange-700'
      case 'net':     return 'font-bold text-green-800 bg-green-50/50 border-t-2 border-green-200'
      default:        return ''
    }
  }

  return (
    <div className="space-y-6">
      {/* Waterfall chart */}
      <div>
        <h3 className="section-title text-sm">Waterfall Laba Rugi</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={waterfallData} margin={{ top: 10, right: 20, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
            <YAxis
              tickFormatter={v => formatRupiah(Math.abs(v), true)}
              tick={{ fontSize: 10 }}
              width={80}
            />
            <Tooltip
              formatter={(v: number) => [formatRupiah(Math.abs(v), true)]}
              labelStyle={{ fontWeight: 600 }}
            />
            <ReferenceLine y={0} stroke="#888" strokeDasharray="3 3" />
            <Bar dataKey="value" radius={[4, 4, 0, 0]}>
              {waterfallData.map((entry, i) => (
                <Cell key={i} fill={waterfallColor(entry.type)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* P&L Table */}
      <div>
        <h3 className="section-title text-sm">Tabel Rekap Laba Rugi</h3>
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-navy text-white">
                <th className="px-4 py-3 text-left text-xs uppercase tracking-wider">Komponen</th>
                <th className="px-4 py-3 text-right text-xs uppercase tracking-wider">Nilai (Rp)</th>
                <th className="px-4 py-3 text-right text-xs uppercase tracking-wider">% GR</th>
              </tr>
            </thead>
            <tbody>
              {rows.filter(row => row.value !== 0).map((row, i) => (
                <tr key={i} className={typeClass(row.type)}>
                  <td className="px-4 py-2.5">{row.label}</td>
                  <td className={`px-4 py-2.5 text-right font-mono ${row.value < 0 ? 'text-red-700' : ''}`}>
                    {row.value < 0 ? `(${formatRupiah(-row.value)})` : formatRupiah(row.value)}
                  </td>
                  <td className={`px-4 py-2.5 text-right font-mono ${row.value < 0 ? 'text-red-700' : ''}`}>
                    {row.value < 0 ? `(${formatPct(row.pct)})` : formatPct(row.pct)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Per-unit stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Rata Harga/Unit', value: formatRupiah(r.rataHargaPerUnit, true) },
          { label: 'HPP/Unit', value: formatRupiah(r.hppPerUnit, true) },
          { label: 'Revenue/m² Kavling', value: formatRupiah(r.revenuePerM2, true) },
          { label: 'Total Unit', value: `${r.totalUnit} unit` },
        ].map((s, i) => (
          <div key={i} className="bg-muted/40 rounded-xl p-3 text-center">
            <div className="text-xs text-muted-foreground">{s.label}</div>
            <div className="font-mono font-bold mt-1 text-sm">{s.value}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
