import { useEffect, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { formatRupiah, formatM2 } from '@/engine/formatter'
import RupiahInput from '@/components/shared/RupiahInput'
import type { FSInputs } from '@/types/fs.types'

const schema = z.object({
  luasLahanTotal:   z.number().min(100, 'Minimal 100 m²').max(10000000),
  pctLahanEfektif:  z.number().min(20, 'Minimal 20%').max(90, 'Maksimal 90%'),
})

type FormData = z.infer<typeof schema>

interface Props {
  inputs: FSInputs
  onChange: (partial: Partial<FSInputs>) => void
}

export default function Step2DataLahan({ inputs, onChange }: Props) {
  const { register, watch, setValue, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      luasLahanTotal:  inputs.lahan.luasLahanTotal,
      pctLahanEfektif: inputs.lahan.pctLahanEfektif,
    },
  })

  const luasLahanTotal  = watch('luasLahanTotal') || 0
  const pctLahanEfektif = watch('pctLahanEfektif') || 50

  const luasEfektif    = useMemo(() => luasLahanTotal * (pctLahanEfektif / 100), [luasLahanTotal, pctLahanEfektif])
  const luasFasum      = useMemo(() => luasLahanTotal - luasEfektif, [luasLahanTotal, luasEfektif])

  // Total kavling dari tipe bangunan
  const totalKavlingTerpakai = useMemo(() => {
    return inputs.tipeBangunan.reduce((sum, t) => sum + t.luasKavling * t.jumlahUnit, 0)
  }, [inputs.tipeBangunan])

  const sisaLahanEfektif = luasEfektif - totalKavlingTerpakai

  useEffect(() => {
    const sub = watch((values) => {
      onChange({
        lahan: {
          luasLahanTotal:  values.luasLahanTotal || 0,
          pctLahanEfektif: values.pctLahanEfektif || 50,
        }
      })
    })
    return () => sub.unsubscribe()
  }, [watch, onChange])

  const pieData = [
    { name: 'Lahan Efektif Terbangun', value: luasEfektif, color: '#0D47A1' },
    { name: 'Fasilitas Umum & Sosial', value: luasFasum, color: '#C9A84C' },
  ]

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Input form */}
        <div className="space-y-5">
          {/* Luas Lahan Total */}
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">
              Luas Lahan Total (m²) *
              <span className="ml-2 text-xs font-normal text-muted-foreground">INPUT UTAMA</span>
            </Label>
            <div className="relative">
              <Input
                {...register('luasLahanTotal', { valueAsNumber: true })}
                type="number"
                className="focus-visible:ring-green-400 border-green-300 text-right pr-12"
                placeholder="130000"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">m²</span>
            </div>
            {errors.luasLahanTotal && (
              <p className="text-xs text-destructive">{errors.luasLahanTotal.message}</p>
            )}
          </div>

          {/* Persentase Efektif */}
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">
              Persentase Lahan Efektif (%)
            </Label>
            <div className="flex items-center gap-3">
              <div className="relative flex-1">
                <Input
                  {...register('pctLahanEfektif', { valueAsNumber: true })}
                  type="number"
                  className="focus-visible:ring-green-400 text-right pr-8"
                  min={20}
                  max={90}
                  step={5}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">%</span>
              </div>
              <div className="flex gap-1">
                {[40, 50, 55, 60].map(v => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setValue('pctLahanEfektif', v)}
                    className={`px-2 py-1 text-xs rounded border transition-all ${
                      pctLahanEfektif === v
                        ? 'bg-navy text-white border-navy'
                        : 'bg-background border-input hover:border-navy/40'
                    }`}
                  >
                    {v}%
                  </button>
                ))}
              </div>
            </div>
            {errors.pctLahanEfektif && (
              <p className="text-xs text-destructive">{errors.pctLahanEfektif.message}</p>
            )}
          </div>

          {/* Auto-calculated results */}
          <div className="bg-muted/40 rounded-xl p-4 space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Hasil Kalkulasi</p>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Lahan Efektif Terbangun:</span>
                <span className="font-mono font-semibold text-blue-700">
                  {luasEfektif.toLocaleString('id-ID')} m²
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Lahan Fasilitas Umum:</span>
                <span className="font-mono font-semibold text-yellow-700">
                  {luasFasum.toLocaleString('id-ID')} m²
                </span>
              </div>
              {totalKavlingTerpakai > 0 && (
                <>
                  <hr className="border-border" />
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Kavling Terpakai (tipe):</span>
                    <span className="font-mono font-semibold">
                      {totalKavlingTerpakai.toLocaleString('id-ID')} m²
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Sisa Lahan Efektif:</span>
                    <span className={`font-mono font-semibold ${sisaLahanEfektif < 0 ? 'text-red-600' : 'text-green-600'}`}>
                      {sisaLahanEfektif.toLocaleString('id-ID')} m²
                    </span>
                  </div>
                  {sisaLahanEfektif < 0 && (
                    <p className="text-xs text-red-600 font-medium">
                      ⚠ Total kavling melebihi lahan efektif!
                    </p>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        {/* Pie chart */}
        {luasLahanTotal > 0 && (
          <div className="flex flex-col items-center justify-center">
            <p className="text-sm font-medium text-muted-foreground mb-3">Distribusi Lahan</p>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={pieData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  innerRadius={40}
                  paddingAngle={3}
                >
                  {pieData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number) => [`${value.toLocaleString('id-ID')} m²`]}
                />
                <Legend
                  formatter={(value) => <span className="text-xs">{value}</span>}
                />
              </PieChart>
            </ResponsiveContainer>

            {/* Stats */}
            <div className="w-full mt-2 grid grid-cols-2 gap-2 text-center">
              <div className="bg-blue-50 dark:bg-blue-950/30 rounded-lg p-3">
                <div className="text-xs text-muted-foreground">Lahan Efektif</div>
                <div className="font-mono font-bold text-blue-700 text-sm">
                  {pctLahanEfektif}%
                </div>
                <div className="text-xs text-muted-foreground">{luasEfektif.toLocaleString('id-ID')} m²</div>
              </div>
              <div className="bg-yellow-50 dark:bg-yellow-950/30 rounded-lg p-3">
                <div className="text-xs text-muted-foreground">Fasilitas Umum</div>
                <div className="font-mono font-bold text-yellow-700 text-sm">
                  {(100 - pctLahanEfektif)}%
                </div>
                <div className="text-xs text-muted-foreground">{luasFasum.toLocaleString('id-ID')} m²</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
