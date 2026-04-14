import { useMemo } from 'react'
import { Label } from '@/components/ui/label'
import RupiahInput from '@/components/shared/RupiahInput'
import { formatRupiah } from '@/engine/formatter'
import {
  calcBiayaPersiapan,
  calcBiayaOperasional,
  calcBiayaPersiapanPerM2,
  calcBiayaOpsPerM2,
  calcHargaJualBangunan,
  calcHargaJualKavling,
} from '@/engine/calculator'
import type { FSInputs } from '@/types/fs.types'

interface Props {
  inputs: FSInputs
  onChange: (partial: Partial<FSInputs>) => void
}

export default function Step5HargaJual({ inputs, onChange }: Props) {
  const totalBP  = useMemo(() => calcBiayaPersiapan(inputs), [inputs])
  const totalBO  = useMemo(() => calcBiayaOperasional(inputs), [inputs])
  const bpPerM2  = useMemo(() => calcBiayaPersiapanPerM2(inputs, totalBP), [inputs, totalBP])
  const boPerM2  = useMemo(() => calcBiayaOpsPerM2(inputs, totalBO), [inputs, totalBO])

  const updateTipe = (tipeId: string, field: string, value: number) =>
    onChange({
      tipeBangunan: inputs.tipeBangunan.map(t =>
        t.id === tipeId ? { ...t, [field]: value } : t
      )
    })

  return (
    <div className="space-y-6">
      {/* Per-m² helpers */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <InfoCard label="Total Biaya Persiapan" value={formatRupiah(totalBP, true)} sub="dari Step 4" />
        <InfoCard label="Total Biaya Operasional" value={formatRupiah(totalBO, true)} sub="dari Step 4" />
        <InfoCard label="Biaya Persiapan / m² Kavling" value={formatRupiah(bpPerM2, true)} sub="auto-kalkulasi" />
        <InfoCard label="Biaya Operasional / m² Kavling" value={formatRupiah(boPerM2, true)} sub="auto-kalkulasi" />
      </div>

      {inputs.tipeBangunan.length === 0 && (
        <div className="py-8 text-center text-muted-foreground">
          Tambahkan tipe bangunan di Step 3 terlebih dahulu.
        </div>
      )}

      {/* Per tipe */}
      {inputs.tipeBangunan.map((tipe, i) => {
        const hargaBangunF1 = calcHargaJualBangunan(tipe, 1)
        const hargaKavling  = calcHargaJualKavling(tipe, bpPerM2, boPerM2)
        const hargaTotal    = hargaBangunF1 + hargaKavling

        return (
          <div key={tipe.id} className="border border-border rounded-xl overflow-hidden">
            {/* Header */}
            <div className="bg-navy px-4 py-3 flex items-center justify-between">
              <span className="font-semibold text-white text-sm">{tipe.nama || `Tipe ${i + 1}`}</span>
              <span className="text-gold text-xs">LB: {tipe.luasBangunan}m² | LK: {tipe.luasKavling}m²</span>
            </div>

            <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Bangunan */}
              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                  A. Harga Jual Bangunan
                </h4>
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <Label className="text-xs shrink-0">Biaya Pokok/m²</Label>
                    <span className="font-mono text-xs text-muted-foreground">
                      {formatRupiah(tipe.biayaKonstruksiPerM2, true)}/m²
                    </span>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Margin/m² (Rp)</Label>
                    <RupiahInput
                      value={tipe.marginBangunanPerM2}
                      onChange={v => updateTipe(tipe.id, 'marginBangunanPerM2', v)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Kelipatan Margin</Label>
                    <input
                      type="number"
                      value={tipe.kelipatanMarginBangunan}
                      onChange={e => updateTipe(tipe.id, 'kelipatanMarginBangunan', parseFloat(e.target.value) || 1)}
                      min={1} step={0.5}
                      className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm font-mono focus:ring-2 focus:ring-green-400 focus:outline-none"
                    />
                  </div>
                  <div className="bg-blue-50 dark:bg-blue-950/30 rounded-lg p-2.5 text-center mt-2">
                    <div className="text-xs text-muted-foreground">Harga Bangunan/unit (Fase 1)</div>
                    <div className="font-mono font-bold text-blue-700 dark:text-blue-400">
                      {formatRupiah(hargaBangunF1, true)}
                    </div>
                  </div>
                </div>
              </div>

              {/* Kavling */}
              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                  B. Harga Jual Kavling
                </h4>
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <Label className="text-xs shrink-0">Biaya Persiapan/m²</Label>
                    <span className="font-mono text-xs text-muted-foreground">{formatRupiah(bpPerM2, true)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <Label className="text-xs shrink-0">Biaya Ops/m²</Label>
                    <span className="font-mono text-xs text-muted-foreground">{formatRupiah(boPerM2, true)}</span>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Margin Kavling/m² (Rp)</Label>
                    <RupiahInput
                      value={tipe.marginKavlingPerM2}
                      onChange={v => updateTipe(tipe.id, 'marginKavlingPerM2', v)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Kelipatan Margin</Label>
                    <input
                      type="number"
                      value={tipe.kelipatanMarginKavling}
                      onChange={e => updateTipe(tipe.id, 'kelipatanMarginKavling', parseFloat(e.target.value) || 1)}
                      min={1} step={0.5}
                      className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm font-mono focus:ring-2 focus:ring-green-400 focus:outline-none"
                    />
                  </div>
                  <div className="bg-yellow-50 dark:bg-yellow-950/30 rounded-lg p-2.5 text-center mt-2">
                    <div className="text-xs text-muted-foreground">Harga Kavling/unit</div>
                    <div className="font-mono font-bold text-yellow-700 dark:text-yellow-400">
                      {formatRupiah(hargaKavling, true)}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Total */}
            <div className="bg-navy/5 dark:bg-navy/20 px-4 py-3 flex items-center justify-between">
              <span className="text-sm font-medium">Total Harga Jual per Unit (Fase 1)</span>
              <span className="font-mono font-bold text-navy dark:text-gold text-base">
                {formatRupiah(hargaTotal, true)}
              </span>
            </div>

            {/* Per-fase preview */}
            {inputs.jumlahFase > 1 && (
              <div className="px-4 pb-4 flex gap-2 flex-wrap mt-1">
                {Array.from({ length: inputs.jumlahFase }, (_, f) => {
                  const hbFase = calcHargaJualBangunan(tipe, f + 1)
                  return (
                    <div key={f} className="bg-muted/40 rounded-lg px-3 py-2 text-center flex-1 min-w-[80px]">
                      <div className="text-xs text-muted-foreground">Fase {f + 1}</div>
                      <div className="font-mono text-xs font-semibold mt-0.5">
                        {formatRupiah(hbFase + hargaKavling, true)}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function InfoCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-muted/40 rounded-xl p-3 text-center">
      <div className="text-xs text-muted-foreground leading-tight">{label}</div>
      <div className="font-mono font-bold text-sm mt-1">{value}</div>
      {sub && <div className="text-xs text-muted-foreground/70 mt-0.5">{sub}</div>}
    </div>
  )
}
