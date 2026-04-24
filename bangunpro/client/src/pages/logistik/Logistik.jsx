import { useEffect, useState } from 'react';
import { Printer, Package, Users } from 'lucide-react';
import Layout from '../../components/layout/Layout';
import { Button, Badge, EmptyState, PageHeader, SectionCard } from '../../components/ui';
import { formatRupiah, formatRupiahShort } from '../../lib/rupiah';
import api from '../../lib/api';
import { useProject } from '../../context/ProjectContext';

export default function Logistik() {
  const { activeProject } = useProject();
  const [data, setData] = useState({ material: [], tenaga: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!activeProject) return;
    setLoading(true);
    api.get(`/logistik/${activeProject.id}`).then(r => setData(r.data)).catch(() => {}).finally(() => setLoading(false));
  }, [activeProject]);

  const totalMaterial = data.material.reduce((s, m) => s + m.biaya, 0);
  const totalTenaga = data.tenaga.reduce((s, t) => s + t.jumlah, 0);

  if (!activeProject) return <Layout title="Logistik"><EmptyState icon="📦" title="Pilih proyek aktif" /></Layout>;

  const TableSection = ({ title, icon: Icon, badge, rows, emptyText, totalLabel, total, cols }) => (
    <SectionCard title={<span className="flex items-center gap-2"><Icon className="w-4 h-4 text-primary" />{title}</span>}
      action={<Badge color="blue">{badge}</Badge>}>
      <div className="overflow-x-auto">
        <table className="tbl">
          <thead>
            <tr>
              {cols.map(c => <th key={c.key} className={c.right ? 'text-right' : ''}>{c.label}</th>)}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={cols.length} className="text-center py-10 text-gray-400">Memuat data...</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={cols.length} className="text-center py-10 text-gray-400 text-sm">{emptyText}</td></tr>
            ) : rows.map((row, i) => (
              <tr key={i}>
                {cols.map(c => (
                  <td key={c.key} className={c.right ? 'text-right font-semibold' : c.bold ? 'font-semibold text-[#1A1A2E]' : 'text-gray-600'}>
                    {c.render ? c.render(row) : row[c.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
          {rows.length > 0 && (
            <tfoot>
              <tr className="bg-amber-50">
                <td colSpan={cols.length - 1} className="px-4 py-2.5 text-sm font-bold text-[#1A1A2E]">{totalLabel}</td>
                <td className="px-4 py-2.5 text-sm font-black text-right text-primary">{formatRupiah(total)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </SectionCard>
  );

  return (
    <Layout title="Logistik & Material">
      <PageHeader title="Logistik & Kebutuhan Material"
        sub={`Total Anggaran Lapangan: ${formatRupiahShort(totalMaterial + totalTenaga)}`}
        actions={<Button variant="outline" size="sm"><Printer className="w-4 h-4" /><span className="hidden sm:inline">Cetak PDF</span></Button>}
      />

      {/* Overview cards */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="card p-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center flex-shrink-0">
            <Package className="w-5 h-5 text-blue-500" />
          </div>
          <div>
            <p className="text-xs text-gray-400 font-semibold uppercase">Total Material</p>
            <p className="font-black text-[#1A1A2E]">{formatRupiahShort(totalMaterial)}</p>
          </div>
        </div>
        <div className="card p-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center flex-shrink-0">
            <Users className="w-5 h-5 text-emerald-500" />
          </div>
          <div>
            <p className="text-xs text-gray-400 font-semibold uppercase">Total Upah</p>
            <p className="font-black text-[#1A1A2E]">{formatRupiahShort(totalTenaga)}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <TableSection title="Kebutuhan Material" icon={Package} badge="GLOBAL" rows={data.material}
          emptyText="Data dihitung otomatis dari koefisien AHSP di RAB"
          totalLabel="TOTAL MATERIAL" total={totalMaterial}
          cols={[
            { key: 'nama', label: 'Nama Barang', bold: true },
            { key: 'volume', label: 'Volume', right: false, render: r => `${r.volume.toFixed(2)} ${r.satuan}` },
            { key: 'biaya', label: 'Est. Biaya', right: true, render: r => formatRupiah(r.biaya) },
          ]}
        />
        <TableSection title="Tenaga Kerja" icon={Users} badge="HOK" rows={data.tenaga}
          emptyText="Data dihitung otomatis dari koefisien AHSP di RAB"
          totalLabel="TOTAL UPAH" total={totalTenaga}
          cols={[
            { key: 'posisi', label: 'Posisi', bold: true },
            { key: 'volume', label: 'Vol', right: false, render: r => `${r.volume.toFixed(2)} ${r.satuan}` },
            { key: 'jumlah', label: 'Jumlah', right: true, render: r => formatRupiah(r.jumlah) },
          ]}
        />
      </div>
    </Layout>
  );
}
