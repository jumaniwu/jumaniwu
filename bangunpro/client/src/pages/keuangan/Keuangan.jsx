import { useEffect, useState } from 'react';
import { Printer, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import Layout from '../../components/layout/Layout';
import { Button, Select, Input, Badge, EmptyState } from '../../components/ui';
import { formatRupiah } from '../../lib/rupiah';
import api from '../../lib/api';
import { useProject } from '../../context/ProjectContext';

const KATEGORI = ['Material (Bahan Bangunan)', 'Upah Tukang / Tenaga', 'Sewa Alat / Tools', 'Operasional (Bensin, Makan, dll)', 'Lain-lain / Tak Terduga'];

const today = new Date().toISOString().split('T')[0];

export default function Keuangan() {
  const { activeProject } = useProject();
  const [transaksi, setTransaksi] = useState([]);
  const [rabItems, setRabItems] = useState([]);
  const [totalRab, setTotalRab] = useState(0);
  const [form, setForm] = useState({ tanggal: today, kategori: KATEGORI[0], alokasi_item_id: '', keterangan: '', nominal: '' });
  const [loading, setLoading] = useState(false);

  const load = async () => {
    if (!activeProject) return;
    const [txRes, rabRes, summaryRes] = await Promise.all([
      api.get(`/keuangan/${activeProject.id}`),
      api.get(`/rab/${activeProject.id}`),
      api.get(`/rab/${activeProject.id}/summary`)
    ]);
    setTransaksi(txRes.data);
    setRabItems(rabRes.data.items || []);
    setTotalRab(summaryRes.data.total || 0);
  };

  useEffect(() => { load(); }, [activeProject]);

  const totalPengeluaran = transaksi.reduce((s, t) => s + t.nominal, 0);
  const sisaBudget = totalRab - totalPengeluaran;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.nominal || Number(form.nominal) <= 0) return toast.error('Nominal harus lebih dari 0');
    setLoading(true);
    try {
      await api.post(`/keuangan/${activeProject.id}`, { ...form, alokasi_item_id: form.alokasi_item_id || null });
      toast.success('Transaksi berhasil dicatat');
      setForm({ tanggal: today, kategori: KATEGORI[0], alokasi_item_id: '', keterangan: '', nominal: '' });
      load();
    } finally { setLoading(false); }
  };

  const handleDelete = async (id) => {
    await api.delete(`/keuangan/${id}`);
    toast.success('Transaksi dihapus');
    load();
  };

  if (!activeProject) return <Layout title="Keuangan"><EmptyState icon="💰" title="Pilih proyek aktif" /></Layout>;

  return (
    <Layout title="Kas & Realisasi">
      <div className="flex items-start justify-between mb-5">
        <div>
          <h2 className="font-bold text-navy">Kas & Realisasi</h2>
          <p className="text-xs text-gray-500">Manajemen pengeluaran proyek berbasis kategori.</p>
        </div>
        <Button variant="outline" size="sm"><Printer className="w-4 h-4" /> Cetak Laporan</Button>
      </div>

      <div className="grid grid-cols-5 gap-5">
        {/* Form Catat Transaksi */}
        <div className="col-span-2">
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <h3 className="font-bold text-navy mb-4 text-sm">+ Catat Transaksi</h3>
            <form onSubmit={handleSubmit} className="space-y-3">
              <Input label="Tanggal" type="date" value={form.tanggal} onChange={e => setForm({ ...form, tanggal: e.target.value })} />
              <Select label="Kategori Biaya" value={form.kategori} onChange={e => setForm({ ...form, kategori: e.target.value })}>
                {KATEGORI.map(k => <option key={k} value={k}>{k}</option>)}
              </Select>
              <Select label="Alokasi Pekerjaan (Opsional)" value={form.alokasi_item_id} onChange={e => setForm({ ...form, alokasi_item_id: e.target.value })}>
                <option value="">-- Pengeluaran Umum --</option>
                {rabItems.map(i => <option key={i.id} value={i.id}>{i.uraian}</option>)}
              </Select>
              <p className="text-xs text-gray-400">Pilih item RAB jika pengeluaran khusus untuk satu pekerjaan tertentu.</p>
              <Input label="Keterangan / Item" value={form.keterangan} onChange={e => setForm({ ...form, keterangan: e.target.value })} placeholder="Cth: Beli Semen 5 Sak..." />
              <Input label="Nominal (Rp)" type="number" value={form.nominal} onChange={e => setForm({ ...form, nominal: e.target.value })} placeholder="0" />
              <Button type="submit" loading={loading} className="w-full justify-center">SIMPAN TRANSAKSI</Button>
            </form>

            {/* Budget Card */}
            <div className="mt-4 bg-navy rounded-xl p-4 text-white">
              <p className="text-white/60 text-xs">SISA BUDGET (RAB - REALISASI)</p>
              <p className={`text-2xl font-black mt-1 ${sisaBudget >= 0 ? 'text-green-400' : 'text-red-400'}`}>{formatRupiah(sisaBudget)}</p>
              <p className="text-white/40 text-xs mt-1">Total RAB Plan: {formatRupiah(totalRab)}</p>
            </div>
          </div>
        </div>

        {/* Riwayat Pengeluaran */}
        <div className="col-span-3">
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b">
              <h3 className="font-bold text-navy text-sm">Riwayat Pengeluaran</h3>
              <Badge color="yellow">Total: {formatRupiah(totalPengeluaran)}</Badge>
            </div>
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b">
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500">TANGGAL</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500">KATEGORI / ITEM</th>
                  <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-500">JUMLAH</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500">AKSI</th>
                </tr>
              </thead>
              <tbody>
                {transaksi.length === 0 ? (
                  <tr><td colSpan="4" className="text-center py-12 text-gray-400 text-sm">Belum ada pengeluaran dicatat.</td></tr>
                ) : transaksi.map(t => (
                  <tr key={t.id} className="border-b hover:bg-gray-50">
                    <td className="px-4 py-2.5 text-sm text-gray-500">{t.tanggal}</td>
                    <td className="px-4 py-2.5">
                      <p className="text-sm font-medium">{t.kategori}</p>
                      {t.keterangan && <p className="text-xs text-gray-400">{t.keterangan}</p>}
                      {t.item_uraian && <p className="text-xs text-blue-500">{t.item_uraian}</p>}
                    </td>
                    <td className="px-4 py-2.5 text-sm font-bold text-right">{formatRupiah(t.nominal)}</td>
                    <td className="px-4 py-2.5">
                      <button onClick={() => handleDelete(t.id)} className="p-1 hover:bg-red-50 rounded text-red-400">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </Layout>
  );
}
