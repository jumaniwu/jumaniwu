import { useMemo } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { v4 as uuidv4 } from 'uuid'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { CHART_COLORS } from '@/engine/formatter'
import type { FSInputs, TipeBangunan } from '@/types/fs.types'
import { DEFAULT_TIPE } from '@/types/fs.types'

interface Props {
  inputs: FSInputs
  onChange: (partial: Partial<FSInputs>) => void
}

export default function Step3TipeBangunan({ inputs, onChange }: Props) {
  const tipes = inputs.tipeBangunan

  const totalUnit        = useMemo(() => tipes.reduce((s, t) => s + t.jumlahUnit, 0), [tipes])
  const totalLuasKavling = useMemo(() => tipes.reduce((s, t) => s + t.luasKavling * t.jumlahUnit, 0), [tipes])
  const luasEfektif      = inputs.lahan.luasLahanTotal * (inputs.lahan.pctLahanEfektif / 100)
  const overCapacity     = luasEfektif > 0 && totalLuasKavling > luasEfektif

  const pieData = tipes.map((t, i) => ({
    name:  t.nama || `Tipe ${i + 1}`,
    value: t.jumlahUnit,
    color: CHART_COLORS[i % CHART_COLORS.length],
  }))

  function addTipe() {
    if (tipes.length >= 10) return
    const newTipe: TipeBangunan = { ...DEFAULT_TIPE, id: uuidv4(), nama: `Tipe ${tipes.length + 1}` }
    onChange({ tipeBangunan: [...tipes, newTipe] })
  }

  function removeTipe(id: string) {
    onChange({ tipeBangunan: tipes.filter(t => t.id !== id) })
  }

  function updateTipe(id: string, field: keyof TipeBangunan, value: string | number) {
    onChange({
      tipeBangunan: tipes.map(t =>
        t.id === id ? { ...t, [field]: value } : t
      )
    })
  }

  const NumInput = ({ tipe, field, placeholder, suffix }: {
    tipe: TipeBangunan
    field: keyof TipeBangunan
    placeholder?: string
    suffix?: string
  }) => (
    <div className="relative">
      <input
        type="number"
        value={(tipe[field] as number) || ''}
        onChange={e => updateTipe(tipe.id, field, parseFloat(e.target.value) || 0)}
        placeholder={placeholder}
        min={0}
        className="w-full h-8 rounded-md border border-input bg-background px-2 pr-8 text-sm font-mono focus:ring-2 focus:ring-green-400 focus:border-green-400 focus:outline-none"
      />
      {suffix && (
        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground select-none">
          {suffix}
        </span>
      )}
    </div>
  )

  return (
    <div className="space-y-5">
      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-navy text-white">
              <th className="px-3 py-3 text-left font-medium text-xs uppercase tracking-wider min-w-[140px]">Nama Tipe</th>
              <th className="px-3 py-3 text-right font-medium text-xs uppercase tracking-wider">LB (m²)</th>
              <th className="px-3 py-3 text-right font-medium text-xs uppercase tracking-wider">LK (m²)</th>
              <th className="px-3 py-3 text-right font-medium text-xs uppercase tracking-wider">Unit</th>
              <th className="px-3 py-3 text-right font-medium text-xs uppercase tracking-wider">Total Kavling</th>
              <th className="px-3 py-3 text-right font-medium text-xs uppercase tracking-wider">% Volume</th>
              <th className="px-1 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {tipes.length === 0 && (
              <tr>
                <td colSpan={7} className="py-8 text-center text-muted-foreground text-sm">
                  Belum ada tipe bangunan. Klik "Tambah Tipe" untuk memulai.
                </td>
              </tr>
            )}
            {tipes.map((t, i) => {
              const totalKavling = t.luasKavling * t.jumlahUnit
              const pctVolume    = totalUnit > 0 ? (t.jumlahUnit / totalUnit * 100).toFixed(1) : '0'
              return (
                <tr key={t.id} className={i % 2 === 0 ? 'bg-background' : 'bg-muted/20'}>
                  <td className="px-3 py-2">
                    <input
                      type="text"
                      value={t.nama}
                      onChange={e => updateTipe(t.id, 'nama', e.target.value)}
                      placeholder={`Tipe ${i + 1}`}
                      className="w-full h-8 rounded-md border border-input bg-background px-2 text-sm focus:ring-2 focus:ring-green-400 focus:border-green-400 focus:outline-none"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <NumInput tipe={t} field="luasBangunan" placeholder="120" suffix="m²" />
                  </td>
                  <td className="px-3 py-2">
                    <NumInput tipe={t} field="luasKavling" placeholder="90" suffix="m²" />
                  </td>
                  <td className="px-3 py-2">
                    <NumInput tipe={t} field="jumlahUnit" placeholder="50" suffix="unit" />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <span className="font-mono text-sm">
                      {totalKavling.toLocaleString('id-ID')} m²
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <span className="font-mono text-sm font-semibold" style={{ color: CHART_COLORS[i % CHART_COLORS.length] }}>
                      {pctVolume}%
                    </span>
                  </td>
                  <td className="px-1 py-2">
                    <button
                      onClick={() => removeTipe(t.id)}
                      className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-red-50 transition-colors"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
          {tipes.length > 0 && (
            <tfoot>
              <tr className="bg-navy/5 border-t border-border font-semibold">
                <td className="px-3 py-2.5 text-sm text-navy dark:text-gold">TOTAL</td>
                <td className="px-3 py-2.5"></td>
                <td className="px-3 py-2.5"></td>
                <td className="px-3 py-2.5 text-right font-mono text-sm">{totalUnit.toLocaleString('id-ID')}</td>
                <td className={`px-3 py-2.5 text-right font-mono text-sm ${overCapacity ? 'text-red-600' : 'text-green-700'}`}>
                  {totalLuasKavling.toLocaleString('id-ID')} m²
                </td>
                <td className="px-3 py-2.5 text-right font-mono text-sm">100%</td>
                <td></td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* Validation */}
      {overCapacity && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
          ⚠ Total luas kavling ({totalLuasKavling.toLocaleString('id-ID')} m²) melebihi lahan efektif ({luasEfektif.toLocaleString('id-ID')} m²)
        </div>
      )}

      {/* Add button */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          size="sm"
          onClick={addTipe}
          disabled={tipes.length >= 10}
          className="gap-2 border-dashed"
        >
          <Plus className="h-4 w-4" />
          Tambah Tipe Bangunan
          {tipes.length > 0 && <span className="text-muted-foreground">({tipes.length}/10)</span>}
        </Button>

        {luasEfektif > 0 && totalLuasKavling > 0 && (
          <div className={`text-sm font-medium ${overCapacity ? 'text-red-600' : 'text-green-700'}`}>
            Kapasitas lahan: {((totalLuasKavling / luasEfektif) * 100).toFixed(1)}% terpakai
          </div>
        )}
      </div>

      {/* Pie chart */}
      {pieData.length > 0 && totalUnit > 0 && (
        <div className="bg-muted/20 rounded-xl p-4">
          <p className="text-sm font-medium mb-3 text-center text-muted-foreground">Distribusi Unit per Tipe</p>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={75} paddingAngle={2}>
                {pieData.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip formatter={(v: number) => [`${v} unit`]} />
              <Legend formatter={(value) => <span className="text-xs">{value}</span>} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}
