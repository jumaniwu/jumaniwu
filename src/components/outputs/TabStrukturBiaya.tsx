import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from 'recharts'
import { formatRupiah, formatPct, CHART_COLORS } from '@/engine/formatter'
import type { FSResults, FSInputs } from '@/types/fs.types'

interface Props {
  results: FSResults
  inputs: FSInputs
}

export default function TabStrukturBiaya({ results: r, inputs }: Props) {
  const costBreakdown = [
    { name: 'Biaya Persiapan', value: r.totalBiayaPersiapan, color: '#0D47A1' },
    { name: 'Biaya Operasional', value: r.totalBiayaOperasional, color: '#C9A84C' },
    { name: 'Biaya Bangunan', value: r.totalBiayaBangun, color: '#1B5E20' },
    { name: 'PPh & Fee', value: r.pphFinal + r.feeMarketing + r.bonusTutupTahun, color: '#B71C1C' },
    { name: 'CSR & Lain', value: r.csr + r.totalRiba, color: '#6A1B9A' },
  ].filter(d => d.value > 0)

  // Biaya per tipe
  const biayaPerTipe = inputs.tipeBangunan.map((tipe, i) => {
    const biayaFases = r.biayaBangunPerFase.filter(b => b.tipeId === tipe.id)
    const totalBiaya = biayaFases.reduce((s, b) => s + b.totalBiaya, 0)

    const hargaFases = r.hargaJualPerFase.filter(h => h.tipeId === tipe.id)
    const avgHarga   = hargaFases.length > 0
      ? hargaFases.reduce((s, h) => s + h.hargaTotal, 0) / hargaFases.length
      : 0

    return {
      name: tipe.nama,
      'Biaya Bangun': Math.round(totalBiaya / inputs.jumlahFase),
      'Harga Jual': Math.round(avgHarga),
      color: CHART_COLORS[i % CHART_COLORS.length],
    }
  })

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Donut chart */}
        <div>
          <h3 className="section-title text-sm">Komposisi Biaya</h3>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie
                data={costBreakdown}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={3}
              >
                {costBreakdown.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip formatter={(v: number) => [formatRupiah(v, true)]} />
              <Legend formatter={(v) => <span className="text-xs">{v}</span>} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Cost table */}
        <div>
          <h3 className="section-title text-sm">Detail Biaya</h3>
          <div className="overflow-hidden rounded-xl border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-navy text-white">
                  <th className="px-4 py-2.5 text-left text-xs uppercase tracking-wider">Komponen</th>
                  <th className="px-4 py-2.5 text-right text-xs uppercase tracking-wider">Nilai</th>
                  <th className="px-4 py-2.5 text-right text-xs uppercase tracking-wider">%</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {costBreakdown.map((row, i) => (
                  <tr key={i} className={i % 2 === 0 ? '' : 'bg-muted/20'}>
                    <td className="px-4 py-2.5 flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: row.color }} />
                      {row.name}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono">
                      {formatRupiah(row.value, true)}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-muted-foreground">
                      {formatPct(row.value / r.totalInvestment * 100)}
                    </td>
                  </tr>
                ))}
                <tr className="bg-navy/5 font-bold">
                  <td className="px-4 py-2.5">Total Investment</td>
                  <td className="px-4 py-2.5 text-right font-mono">{formatRupiah(r.totalInvestment, true)}</td>
                  <td className="px-4 py-2.5 text-right font-mono">100%</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* HPP vs Harga Jual per tipe */}
      {biayaPerTipe.length > 0 && (
        <div>
          <h3 className="section-title text-sm">HPP vs Harga Jual per Tipe (Rata-rata/unit)</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={biayaPerTipe} margin={{ top: 10, right: 20, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tickFormatter={v => formatRupiah(v, true)} tick={{ fontSize: 10 }} width={90} />
              <Tooltip formatter={(v: number) => [formatRupiah(v, true)]} />
              <Legend />
              <Bar dataKey="Biaya Bangun" fill="#B71C1C" radius={[3, 3, 0, 0]} />
              <Bar dataKey="Harga Jual" fill="#1B5E20" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}
