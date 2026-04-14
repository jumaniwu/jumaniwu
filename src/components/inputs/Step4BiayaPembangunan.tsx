import { useMemo } from 'react'
import { Label } from '@/components/ui/label'
import RupiahInput from '@/components/shared/RupiahInput'
import { formatRupiah } from '@/engine/formatter'
import { calcBiayaPersiapan, calcBiayaOperasional } from '@/engine/calculator'
import type { FSInputs } from '@/types/fs.types'

interface Props {
  inputs: FSInputs
  onChange: (partial: Partial<FSInputs>) => void
}

const SectionTitle = ({ children }: { children: React.ReactNode }) => (
  <div className="flex items-center gap-2 mb-4 pb-2 border-b border-border">
    <h3 className="font-serif font-semibold text-navy dark:text-gold text-base">{children}</h3>
  </div>
)

const RowInput = ({ label, value, onChange, hint }: {
  label: string; value: number; onChange: (v: number) => void; hint?: string
}) => (
  <div className="flex items-center justify-between gap-4 py-2">
    <div className="min-w-0">
      <Label className="text-sm">{label}</Label>
      {hint && <p className="text-xs text-muted-foreground mt-0.5">{hint}</p>}
    </div>
    <div className="w-52 shrink-0">
      <RupiahInput value={value} onChange={onChange} />
    </div>
  </div>
)

export default function Step4BiayaPembangunan({ inputs, onChange }: Props) {
  const bp  = inputs.biayaPersiapan
  const bo  = inputs.biayaOperasional

  const totalBiayaPersiapan   = useMemo(() => calcBiayaPersiapan(inputs), [inputs])
  const totalBiayaOperasional = useMemo(() => calcBiayaOperasional(inputs), [inputs])

  const totalBiayaBangun = useMemo(() => {
    let total = 0
    for (const tipe of inputs.tipeBangunan) {
      for (let fase = 1; fase <= inputs.jumlahFase; fase++) {
        const kenaikan    = Math.pow(1 + tipe.kenaikanBiayaPerFase / 100, fase - 1)
        const biayaPerUnit = tipe.biayaKonstruksiPerM2 * kenaikan * tipe.luasBangunan
        const unitTerjual  = inputs.penjualan.find(p => p.tipeId === tipe.id && p.fase === fase)?.unitTerjual ?? 0
        total += biayaPerUnit * (unitTerjual || tipe.jumlahUnit / inputs.jumlahFase)
      }
    }
    return total
  }, [inputs])

  const updateBP = (field: string, value: number) =>
    onChange({ biayaPersiapan: { ...bp, [field]: value } })

  const updateBO = (field: string, value: number) =>
    onChange({ biayaOperasional: { ...bo, [field]: value } })

  const updateTipeBiaya = (tipeId: string, field: string, value: number) =>
    onChange({
      tipeBangunan: inputs.tipeBangunan.map(t =>
        t.id === tipeId ? { ...t, [field]: value } : t
      )
    })

  return (
    <div className="space-y-8">

      {/* A. Biaya Persiapan */}
      <div>
        <SectionTitle>A. Biaya Persiapan Proyek</SectionTitle>
        <div className="space-y-1 divide-y divide-border/60">
          <RowInput
            label="Harga Beli Lahan"
            value={bp.hargaBeliLahan}
            onChange={v => updateBP('hargaBeliLahan', v)}
            hint={`Luas lahan: ${inputs.lahan.luasLahanTotal.toLocaleString('id-ID')} m²`}
          />
          <RowInput
            label="Biaya Perizinan & Legalitas"
            value={bp.biayaPerizinan}
            onChange={v => updateBP('biayaPerizinan', v)}
          />
          <RowInput
            label="Biaya Pengolahan Lahan"
            value={bp.biayaPengolahanLahan}
            onChange={v => updateBP('biayaPengolahanLahan', v)}
          />
          <RowInput
            label="Biaya Sarana & Prasarana"
            value={bp.biayaSaranadanPrasarana}
            onChange={v => updateBP('biayaSaranadanPrasarana', v)}
            hint="Jalan, drainase, PLN, PDAM"
          />
          <RowInput
            label="Biaya Inventaris Proyek"
            value={bp.biayaInventarisProyek}
            onChange={v => updateBP('biayaInventarisProyek', v)}
            hint="Peralatan, kantor pemasaran, dll"
          />
        </div>
        <div className="mt-3 flex justify-end">
          <div className="bg-navy/5 dark:bg-navy/20 rounded-lg px-4 py-2.5 text-right">
            <div className="text-xs text-muted-foreground">Total Biaya Persiapan</div>
            <div className="font-mono font-bold text-navy dark:text-gold text-lg">
              {formatRupiah(totalBiayaPersiapan, true)}
            </div>
          </div>
        </div>
      </div>

      {/* B. Biaya Operasional */}
      <div>
        <SectionTitle>B. Biaya Operasional (per bulan)</SectionTitle>
        <div className="space-y-1 divide-y divide-border/60">
          <RowInput
            label="Biaya Pemasaran / Marketing"
            value={bo.biayaMarketingPerBulan}
            onChange={v => updateBO('biayaMarketingPerBulan', v)}
            hint="per bulan"
          />
          <RowInput
            label="Biaya Umum Kantor"
            value={bo.biayaUmumKantorPerBulan}
            onChange={v => updateBO('biayaUmumKantorPerBulan', v)}
            hint="per bulan (gaji, utilitas, dll)"
          />
        </div>
        <div className="mt-3 grid grid-cols-3 gap-3">
          {[1, 2, 3].map(fase => {
            const totalFase = (bo.biayaMarketingPerBulan + bo.biayaUmumKantorPerBulan) * inputs.durasiPerFase
            return (
              <div key={fase} className="bg-muted/40 rounded-lg p-3 text-center">
                <div className="text-xs text-muted-foreground">Total Fase {fase}</div>
                <div className="font-mono font-semibold text-sm mt-0.5">{formatRupiah(totalFase, true)}</div>
              </div>
            )
          }).slice(0, inputs.jumlahFase)}
          <div className="bg-navy/5 dark:bg-navy/20 rounded-lg p-3 text-center">
            <div className="text-xs text-muted-foreground">Total Proyek</div>
            <div className="font-mono font-bold text-navy dark:text-gold text-sm mt-0.5">
              {formatRupiah(totalBiayaOperasional, true)}
            </div>
          </div>
        </div>
      </div>

      {/* C. Biaya Pokok Bangunan */}
      {inputs.tipeBangunan.length > 0 && (
        <div>
          <SectionTitle>C. Biaya Pokok Bangunan (per tipe)</SectionTitle>
          <div className="space-y-4">
            {inputs.tipeBangunan.map((tipe, i) => (
              <div key={tipe.id} className="border border-border rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold text-sm">{tipe.nama || `Tipe ${i + 1}`}</h4>
                  <span className="text-xs text-muted-foreground">
                    LB: {tipe.luasBangunan} m² | {tipe.jumlahUnit} unit
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Biaya Konstruksi (Rp/m²)</Label>
                    <RupiahInput
                      value={tipe.biayaKonstruksiPerM2}
                      onChange={v => updateTipeBiaya(tipe.id, 'biayaKonstruksiPerM2', v)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Kenaikan Biaya per Fase (%)</Label>
                    <div className="relative">
                      <input
                        type="number"
                        value={tipe.kenaikanBiayaPerFase}
                        onChange={e => updateTipeBiaya(tipe.id, 'kenaikanBiayaPerFase', parseFloat(e.target.value) || 0)}
                        className="h-10 w-full rounded-md border border-input bg-background px-3 pr-8 text-sm font-mono focus:ring-2 focus:ring-green-400 focus:outline-none"
                        min={0}
                        max={30}
                        step={0.5}
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
                    </div>
                  </div>
                </div>

                {/* Per-fase preview */}
                <div className="flex gap-2 flex-wrap">
                  {Array.from({ length: inputs.jumlahFase }, (_, f) => {
                    const kenaikan    = Math.pow(1 + tipe.kenaikanBiayaPerFase / 100, f)
                    const biayaPerUnit = tipe.biayaKonstruksiPerM2 * kenaikan * tipe.luasBangunan
                    return (
                      <div key={f} className="bg-muted/40 rounded-lg px-3 py-1.5 text-center min-w-[90px]">
                        <div className="text-xs text-muted-foreground">Fase {f + 1}</div>
                        <div className="font-mono text-xs font-semibold mt-0.5">
                          {formatRupiah(biayaPerUnit, true)}/unit
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-3 flex justify-end">
            <div className="bg-navy/5 dark:bg-navy/20 rounded-lg px-4 py-2.5 text-right">
              <div className="text-xs text-muted-foreground">Estimasi Total Biaya Bangun</div>
              <div className="font-mono font-bold text-navy dark:text-gold text-lg">
                {formatRupiah(totalBiayaBangun, true)}
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">(berdasarkan unit terjual)</div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
