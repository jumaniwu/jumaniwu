import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import Layout from '../../components/layout/Layout';
import { formatRupiah } from '../../lib/rupiah';
import api from '../../lib/api';
import { useProject } from '../../context/ProjectContext';
import { EmptyState } from '../../components/ui';

const KATEGORI_MAP = {
  'persiapan': 'Persiapan',
  'pondasi': 'Pondasi',
  'beton-struktur': 'Beton Struktur',
  'kanopi': 'Kanopi',
  'baja-struktural': 'Baja Struktural',
  'tangga': 'Tangga',
  'pek-atap': 'Atap',
};

export default function PekerjaanPage() {
  const { jenis } = useParams();
  const { activeProject } = useProject();
  const [items, setItems] = useState([]);
  const kategori = KATEGORI_MAP[jenis] || jenis;

  useEffect(() => {
    if (!activeProject) return;
    api.get(`/master-analisa`).then(r => {
      const filtered = r.data.filter(a => a.kategori === kategori);
      // Get matching RAB items
      api.get(`/rab/${activeProject.id}`).then(rabRes => {
        const relevantItems = rabRes.data.items.filter(i => i.analisa_source === 'ahsp_sni' || filtered.some(a => i.uraian.includes(a.nama)));
        setItems(relevantItems);
      });
    });
  }, [activeProject, jenis]);

  const pageTitle = `Pekerjaan ${kategori}`;

  if (!activeProject) return <Layout title={pageTitle}><EmptyState icon="🔧" title="Pilih proyek aktif" /></Layout>;

  return (
    <Layout title={pageTitle}>
      <div className="mb-5">
        <h2 className="font-bold text-navy">Pekerjaan {kategori}</h2>
        <p className="text-xs text-gray-500">Item RAB berkaitan dengan pekerjaan {kategori.toLowerCase()} pada proyek aktif</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 border-b">
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">NO</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">URAIAN PEKERJAAN</th>
              <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500">VOL</th>
              <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500">SAT</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500">HARGA SATUAN</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500">JUMLAH</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr><td colSpan="6" className="text-center py-12 text-gray-400 text-sm">Belum ada item pekerjaan {kategori}. Tambahkan via Rekapitulasi RAB.</td></tr>
            ) : items.map((item, i) => (
              <tr key={item.id} className="border-b hover:bg-gray-50">
                <td className="px-4 py-3 text-xs text-gray-400">{i + 1}</td>
                <td className="px-4 py-3 text-sm">{item.uraian}</td>
                <td className="px-4 py-3 text-sm text-center text-green-600 font-bold">{item.volume}</td>
                <td className="px-4 py-3 text-sm text-center text-gray-500">{item.satuan}</td>
                <td className="px-4 py-3 text-sm text-right">{formatRupiah(item.harga_satuan)}</td>
                <td className="px-4 py-3 text-sm font-bold text-right">{formatRupiah(item.subtotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Layout>
  );
}
