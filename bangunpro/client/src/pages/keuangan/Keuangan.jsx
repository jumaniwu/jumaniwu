import { useEffect, useState } from 'react';
import { Printer, Trash2, TrendingDown, Wallet } from 'lucide-react';
import toast from 'react-hot-toast';
import Layout from '../../components/layout/Layout';
import { Button, Select, Input, Badge, EmptyState, PageHeader, SectionCard } from '../../components/ui';
import { formatRupiah, formatRupiahShort } from '../../lib/rupiah';
import api from '../../lib/api';
import { useProject } from '../../context/ProjectContext';

const KATEGORI = [
  'Material (Bahan Bangunan)', 'Upah Tukang / Tenaga',
  'Sewa Alat / Tools', 'Operasional (Bensin, Makan, dll)', 'Lain-lain / Tak Terduga'
];

const KATEGORI_COLORS = {
  'Material (Bahan Bangunan)': 'blue', 'Upah Tukang / Tenaga': 'green',
  'Sewa Alat / Tools': 'orange', 'Operasional (Bensin, Makan, dll)': 'purple', 'Lain-lain / Tak Terduga': 'gray'
};

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
  const pctTerpakai = totalRab > 0 ? (totalPengeluaran / totalRab * 100) : 0;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.nominal || Number(form.nominal) <= 0) return toast.error('Nominal harus lebih dari 0');
    setLoading(true);
    try {
      await api.post(`/keuangan/${activeProject.id}`, { ...form, alokasi_item_id: form.alokasi_item_id || null });
      toast.success('Transaksi dicatat!');
      setForm({ tanggal: today, kategori: KATEGORI[0], alokasi_item_id: '', keterangan: '', nominal: '' });
      load();
    } finally { setLoading(false); }
  };

  if (!activeProject) return <Layout title="Keuangan"><EmptyState icon="💰" title="Pilih proyek aktif" /></Layout>;

  return (
    <Layout title="Kas & Realisasi">
      <PageHeader title="Kas & Realisasi" sub="Manajemen pengeluaran proyek."
        actions={<Button variant="outline" size="sm"><Printer className="w-4 h-4" /><span className="hidden sm:inline">Cetak</span></Button>}
      />

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Left: Form */}
        <div className="lg:col-span-2 space-y-4">
          <SectionCard title="+ Catat Transaksi">
            <div className="p-5">
              <form onSubmit={handleSubmit} className="space-y-3">
                <Input label="Tanggal" type="date" value={form.tanggal} onChange={e => setForm({ ...form, tanggal: e.target.value })} />
                <Select label="Kategori Biaya" value={form.kategori} onChange={e => setForm({ ...form, kategori: e.target.value })}>
                  {KATEGORI.map(k => <option key={k} value={k}>{k}</option>)}
                </Select>
                <Select label="Alokasi Pekerjaan (Opsional)" value={form.alokasi_item_id} onChange={e => setForm({ ...form, alokasi_item_id: e.target.value })}>
                  <option value="">-- Pengeluaran Umum --</option>
                  {rabItems.map(i => <option key={i.id} value={i.id}>{i.uraian}</option>)}
                </Select>
                <Input label="Keterangan" value={form.keterangan} onChange={e => setForm({ ...form, keterangan: e.target.value })} placeholder="Cth: Beli Semen 5 Sak..." />
                <Input label="Nominal (Rp)" type="number" value={form.nominal} onChange={e => setForm({ ...form, nominal: e.target.value })} placeholder="0" />
                <Button type="submit" loading={loading} className="w-full justify-center" size="lg">SIMPAN TRANSAKSI</Button>
              </form>
            </div>
          </SectionCard>

          {/* Budget card */}
          <div className="rounded-2xl p-5 text-white" style={{ background: '#1A1A2E' }}>
            <div className="flex items-center gap-2 mb-3">
              <Wallet className="w-4 h-4 text-primary" />
              <span className="text-white/60 text-xs uppercase tracking-wide font-semibold">Budget Overview</span>
            </div>
            <div className="flex items-end justify-between mb-3">
              <div>
                <p className="text-white/40 text-xs">Terpakai</p>
                <p className="text-red-400 font-black text-xl">{formatRupiahShort(totalPengeluaran)}</p>
              </div>
              <div className="text-right">
                <p className="text-white/40 text-xs">Sisa Budget</p>
                <p className={`font-black text-xl ${sisaBudget >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{formatRupiahShort(sisaBudget)}</p>
              </div>
            </div>
            <div className="h-2 bg-white/10 rounded-full overflow-hidden mb-1.5">
              <div className={`h-2 rounded-full transition-all ${pctTerpakai > 90 ? 'bg-red-400' : 'bg-primary'}`}
                style={{ width: `${Math.min(100, pctTerpakai)}%` }} />
            </div>
            <p className="text-white/30 text-xs text-right">{pctTerpakai.toFixed(1)}% dari {formatRupiahShort(totalRab)}</p>
          </div>
        </div>

        {/* Right: History */}
        <div className="lg:col-span-3">
          <SectionCard title="Riwayat Pengeluaran"
            action={<Badge color="yellow">Total: {formatRupiah(totalPengeluaran)}</Badge>}>
            <div className="overflow-x-auto">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Tanggal</th>
                    <th>Kategori / Keterangan</th>
                    <th className="text-right">Jumlah</th>
                    <th className="w-12"></th>
                  </tr>
                </thead>
                <tbody>
                  {transaksi.length === 0 ? (
                    <tr><td colSpan="4" className="text-center py-12 text-gray-400 text-sm">
                      <TrendingDown className="w-8 h-8 mx-auto mb-2 text-gray-200" />
                      Belum ada pengeluaran dicatat.
                    </td></tr>
                  ) : transaksi.map(t => (
                    <tr key={t.id}>
                      <td className="text-gray-500 whitespace-nowrap">{t.tanggal}</td>
                      <td>
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge color={KATEGORI_COLORS[t.kategori] || 'gray'} className="text-[10px]">
                            {t.kategori.split(' ')[0]}
                          </Badge>
                        </div>
                        {t.keterangan && <p className="text-xs text-gray-500 mt-0.5">{t.keterangan}</p>}
                        {t.item_uraian && <p className="text-xs text-blue-500 mt-0.5 truncate max-w-48">{t.item_uraian}</p>}
                      </td>
                      <td className="font-bold text-right text-red-500 whitespace-nowrap">{formatRupiah(t.nominal)}</td>
                      <td>
                        <button onClick={async () => { await api.delete(`/keuangan/${t.id}`); load(); }}
                          className="p-1.5 hover:bg-red-50 rounded-lg text-gray-300 hover:text-red-400 transition-all">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </SectionCard>
        </div>
      </div>
    </Layout>
  );
}
