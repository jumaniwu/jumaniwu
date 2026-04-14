import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line,
} from 'recharts'
import { formatRupiah, CHART_COLORS } from '@/engine/formatter'
import type { FSResults, FSInputs } from '@/types/fs.types'

interface Props {
  results: FSResults
  inputs: FSInputs
}

export default function TabProyeksiPendapatan({ results: r, inputs }: Props) {
  // Penerimaan per fase per tipe — grouped bar
  const faseData = Array.from({ length: inputs.jumlahFase }, (_, fi) => {
    const fase = fi + 1
    const row: Record<string, number | string> = { name: `Fase ${fase}` }
    for (const tipe of inputs.tipeBangunan) {
      const p = r.penerimaanPerFase.find(x => x.tipeId === tipe.id && x.fase === fase)
      row[tipe.nama] = p?.totalPenerimaan ?? 0
    }
    return row
  })

  // Harga jual per fase — line chart
  const hargaData = Array.from({ length: inputs.jumlahFase }, (_, fi) => {
    const fase = fi + 1
    const row: Record<string, number | string> = { name: `Fase ${fase}` }
    for (const tipe of inputs.tipeBangunan) {
      const h = r.hargaJualPerFase.find(x => x.tipeId === tipe.id && x.fase === fase)
      row[tipe.nama] = h?.hargaTotal ?? 0
    }
    return row
  })

  // Summary per fase
  const faseSummary = Array.from({ length: inputs.jumlahFase }, (_, fi) => {
    const fase = fi + 1
    const totalUnit = inputs.tipeBangunan.reduce((s, t) => {
      const p = r.penerimaanPerFase.find(x => x.tipeId === t.id && x.fase === fase)
      return s + (p?.unitTerjual ?? 0)
    }, 0)
    const totalPenerimaan = r.penerimaanPerFase
      .filter(p => p.fase === fase)
      .reduce((s, p) => s + p.totalPenerimaan, 0)
    return { fase, totalUnit, totalPenerimaan }
  })

  return (
    <div className="space-y-6">
      {/* Grouped bar: penerimaan per fase per tipe */}
      <div>
        <h3 className="section-title text-sm">Penerimaan per Fase per Tipe</h3>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={faseData} margin={{ top: 10, right: 20, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="name" tick={{ fontSize: 12 }} />
            <YAxis tickFormatter={v => formatRupiah(v, true)} tick={{ fontSize: 10 }} width={90} />
            <Tooltip formatter={(v: number) => [formatRupiah(v, true)]} />
            <Legend />
            {inputs.tipeBangunan.map((t, i) => (
              <Bar key={t.id} dataKey={t.nama} fill={CHART_COLORS[i % CHART_COLORS.length]} radius={[3, 3, 0, 0]} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Line chart: harga jual per tipe */}
      {inputs.jumlahFase > 1 && (
        <div>
          <h3 className="section-title text-sm">Tren Harga Jual per Tipe (naik per fase)</h3>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={hargaData} margin={{ top: 10, right: 20, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tickFormatter={v => formatRupiah(v, true)} tick={{ fontSize: 10 }} width={90} />
              <Tooltip formatter={(v: number) => [formatRupiah(v, true)]} />
              <Legend />
              {inputs.tipeBangunan.map((t, i) => (
                <Line
                  key={t.id}
                  type="monotone"
                  dataKey={t.nama}
                  stroke={CHART_COLORS[i % CHART_COLORS.length]}
                  strokeWidth={2}
                  dot={{ r: 5 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Summary table */}
      <div>
        <h3 className="section-title text-sm">Tabel Penerimaan per Fase</h3>
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-navy text-white">
                <th className="px-4 py-3 text-left text-xs uppercase tracking-wider">Tipe</th>
                {Array.from({ length: inputs.jumlahFase }, (_, i) => (
                  <th key={i} className="px-4 py-3 text-right text-xs uppercase tracking-wider">Fase {i + 1}</th>
                ))}
                <th className="px-4 py-3 text-right text-xs uppercase tracking-wider">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {inputs.tipeBangunan.map((tipe, ti) => {
                const total = r.penerimaanPerFase
                  .filter(p => p.tipeId === tipe.id)
                  .reduce((s, p) => s + p.totalPenerimaan, 0)
                return (
                  <tr key={tipe.id} className={ti % 2 === 0 ? '' : 'bg-muted/20'}>
                    <td className="px-4 py-2.5 font-medium">{tipe.nama}</td>
                    {Array.from({ length: inputs.jumlahFase }, (_, fi) => {
                      const fase = fi + 1
                      const p = r.penerimaanPerFase.find(x => x.tipeId === tipe.id && x.fase === fase)
                      return (
                        <td key={fi} className="px-4 py-2.5 text-right font-mono text-sm">
                          {p && p.totalPenerimaan > 0 ? (
                            <div>
                              <div>{formatRupiah(p.totalPenerimaan, true)}</div>
                              <div className="text-xs text-muted-foreground">{p.unitTerjual} unit</div>
                            </div>
                          ) : '—'}
                        </td>
                      )
                    })}
                    <td className="px-4 py-2.5 text-right font-mono font-semibold">
                      {formatRupiah(total, true)}
                    </td>
                  </tr>
                )
              })}
              <tr className="bg-navy/5 font-bold border-t-2 border-navy/20">
                <td className="px-4 py-3 text-navy dark:text-gold">TOTAL</td>
                {faseSummary.map(fs => (
                  <td key={fs.fase} className="px-4 py-3 text-right font-mono">
                    <div>{formatRupiah(fs.totalPenerimaan, true)}</div>
                    <div className="text-xs font-normal text-muted-foreground">{fs.totalUnit} unit</div>
                  </td>
                ))}
                <td className="px-4 py-3 text-right font-mono text-navy dark:text-gold">
                  {formatRupiah(r.grossRevenue, true)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
