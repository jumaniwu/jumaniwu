import { useEffect, useState } from 'react';
import { Printer } from 'lucide-react';
import Layout from '../../components/layout/Layout';
import { Button, Badge, EmptyState } from '../../components/ui';
import { formatRupiah } from '../../lib/rupiah';
import api from '../../lib/api';
import { useProject } from '../../context/ProjectContext';

export default function Logistik() {
  const { activeProject } = useProject();
  const [data, setData] = useState({ material: [], tenaga: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!activeProject) return;
    setLoading(true);
    api.get(`/logistik/${activeProject.id}`)
      .then(r => setData(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [activeProject]);

  const totalMaterial = data.material.reduce((s, m) => s + m.biaya, 0);
  const totalTenaga = data.tenaga.reduce((s, t) => s + t.jumlah, 0);

  if (!activeProject) return <Layout title="Logistik"><EmptyState icon="📦" title="Pilih proyek aktif" /></Layout>;

  return (
    <Layout title="Logistik & Kebutuhan Material">
      <div className="flex items-start justify-between mb-5">
        <div>
          <h2 className="font-bold text-navy">Logistik & Kebutuhan Material</h2>
          <p className="text-xs text-gray-500">Total Anggaran Lapangan (RAP): <strong>{formatRupiah(totalMaterial + totalTenaga)}</strong></p>
        </div>
        <Button variant="outline" size="sm"><Printer className="w-4 h-4" /> CETAK PDF</Button>
      </div>

      <div className="grid grid-cols-2 gap-5">
        {/* Material */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-3 border-b">
            <h3 className="font-bold text-navy text-sm">Kebutuhan Material</h3>
            <Badge color="blue">GLOBAL</Badge>
          </div>
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b">
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500">NAMA BARANG</th>
                <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-500">VOLUME</th>
                <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-500">ESTIMASI BIAYA</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="3" className="text-center py-8 text-gray-400">Memuat...</td></tr>
              ) : data.material.length === 0 ? (
                <tr><td colSpan="3" className="text-center py-8 text-gray-400 text-sm">Data dihitung dari AHSP di RAB</td></tr>
              ) : data.material.map((m, i) => (
                <tr key={i} className="border-b hover:bg-gray-50">
                  <td className="px-4 py-2.5 text-sm">{m.nama}</td>
                  <td className="px-4 py-2.5 text-sm text-right text-gray-600">{m.volume.toFixed(2)} {m.satuan}</td>
                  <td className="px-4 py-2.5 text-sm font-semibold text-right">{formatRupiah(m.biaya)}</td>
                </tr>
              ))}
            </tbody>
            {data.material.length > 0 && (
              <tfoot>
                <tr className="bg-yellow-50">
                  <td colSpan="2" className="px-4 py-2.5 text-sm font-bold">TOTAL MATERIAL</td>
                  <td className="px-4 py-2.5 text-sm font-bold text-right">{formatRupiah(totalMaterial)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        {/* Tenaga */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-3 border-b">
            <h3 className="font-bold text-navy text-sm">Tenaga Kerja</h3>
            <Badge color="orange">HOK</Badge>
          </div>
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b">
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500">POSISI</th>
                <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-500">VOL</th>
                <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-500">JUMLAH</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="3" className="text-center py-8 text-gray-400">Memuat...</td></tr>
              ) : data.tenaga.length === 0 ? (
                <tr><td colSpan="3" className="text-center py-8 text-gray-400 text-sm">Data dihitung dari AHSP di RAB</td></tr>
              ) : data.tenaga.map((t, i) => (
                <tr key={i} className="border-b hover:bg-gray-50">
                  <td className="px-4 py-2.5 text-sm">{t.posisi}</td>
                  <td className="px-4 py-2.5 text-sm text-right text-gray-600">{t.volume.toFixed(2)} {t.satuan}</td>
                  <td className="px-4 py-2.5 text-sm font-semibold text-right">{formatRupiah(t.jumlah)}</td>
                </tr>
              ))}
            </tbody>
            {data.tenaga.length > 0 && (
              <tfoot>
                <tr className="bg-yellow-50">
                  <td colSpan="2" className="px-4 py-2.5 text-sm font-bold">TOTAL UPAH</td>
                  <td className="px-4 py-2.5 text-sm font-bold text-right">{formatRupiah(totalTenaga)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </Layout>
  );
}
