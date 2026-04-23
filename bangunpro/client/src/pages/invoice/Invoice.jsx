import { useEffect, useState } from 'react';
import { Printer, Plus, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import Layout from '../../components/layout/Layout';
import { Button, Modal, Badge, EmptyState, Input, Select } from '../../components/ui';
import { formatRupiah } from '../../lib/rupiah';
import api from '../../lib/api';
import { useProject } from '../../context/ProjectContext';

const TERMIN_OPTIONS = ['Termin 1 (DP)', 'Termin 1', 'Termin 2', 'Termin 3', 'Termin Akhir / Retensi'];

export default function Invoice() {
  const { activeProject } = useProject();
  const [invoices, setInvoices] = useState([]);
  const [totalRab, setTotalRab] = useState(0);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ tanggal_invoice: '', jatuh_tempo: '', keterangan_termin: TERMIN_OPTIONS[0], mode_harga: 'persen', persentase: 0, nominal: 0 });

  const load = async () => {
    if (!activeProject) return;
    const [invRes, rabRes] = await Promise.all([
      api.get(`/invoice/${activeProject.id}`),
      api.get(`/rab/${activeProject.id}/summary`)
    ]);
    setInvoices(invRes.data);
    setTotalRab(rabRes.data.total || 0);
  };

  useEffect(() => { load(); }, [activeProject]);

  const totalTagih = invoices.reduce((s, i) => s + i.nominal, 0);
  const totalLunas = invoices.filter(i => i.status === 'lunas').reduce((s, i) => s + i.nominal, 0);
  const pctTagih = totalRab > 0 ? (totalTagih / totalRab * 100) : 0;
  const sisaPlafon = 100 - pctTagih;

  const handleSubmit = async () => {
    if (!form.tanggal_invoice) return toast.error('Tanggal invoice wajib diisi');
    await api.post(`/invoice/${activeProject.id}`, form);
    toast.success('Invoice berhasil dibuat');
    setShowModal(false);
    setForm({ tanggal_invoice: '', jatuh_tempo: '', keterangan_termin: TERMIN_OPTIONS[0], mode_harga: 'persen', persentase: 0, nominal: 0 });
    load();
  };

  const handleStatusToggle = async (inv) => {
    await api.put(`/invoice/${inv.id}`, { status: inv.status === 'lunas' ? 'pending' : 'lunas' });
    load();
  };

  const handleDelete = async (id) => {
    await api.delete(`/invoice/${id}`);
    toast.success('Invoice dihapus');
    load();
  };

  if (!activeProject) return <Layout title="Invoice"><EmptyState icon="🧾" title="Pilih proyek aktif" /></Layout>;

  return (
    <Layout title="Invoice & Termin">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h2 className="font-bold text-navy">Invoice & Termin</h2>
          <p className="text-xs text-gray-500">Kelola penagihan bertahap (Progress Payment).</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm"><Printer className="w-4 h-4" /> Cetak Rekap</Button>
          <Button onClick={() => setShowModal(true)} size="sm"><Plus className="w-4 h-4" /> Buat Invoice</Button>
        </div>
      </div>

      {/* Summary Bar */}
      <div className="bg-navy rounded-xl p-4 mb-5 flex items-center gap-6">
        <div>
          <p className="text-white/60 text-xs">Total RAB</p>
          <p className="text-white font-bold">{formatRupiah(totalRab)}</p>
        </div>
        <div className="flex-1">
          <div className="flex justify-between text-xs text-white/70 mb-1">
            <span>Progress Penagihan: {pctTagih.toFixed(1)}%</span>
            <span className="text-red-300">Sisa Plafon: {sisaPlafon.toFixed(1)}%</span>
          </div>
          <div className="h-2 bg-white/10 rounded-full">
            <div className="h-2 bg-primary rounded-full" style={{ width: `${Math.min(100, pctTagih)}%` }} />
          </div>
        </div>
        <div className="text-right">
          <p className="text-white/60 text-xs">Sudah Lunas</p>
          <p className="text-green-400 font-bold">{formatRupiah(totalLunas)}</p>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 border-b">
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">NO. INVOICE</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">KETERANGAN (TERMIN)</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">TGL INVOICE</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500">NOMINAL (RP)</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">STATUS</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">AKSI</th>
            </tr>
          </thead>
          <tbody>
            {invoices.length === 0 ? (
              <tr><td colSpan="6" className="text-center py-12 text-gray-400 text-sm">Belum ada invoice. Klik "+ Buat Invoice" untuk mulai.</td></tr>
            ) : invoices.map(inv => (
              <tr key={inv.id} className="border-b hover:bg-gray-50">
                <td className="px-4 py-3 text-sm font-mono">{inv.no_invoice}</td>
                <td className="px-4 py-3 text-sm">{inv.keterangan_termin}</td>
                <td className="px-4 py-3 text-sm text-gray-500">{inv.tanggal_invoice}</td>
                <td className="px-4 py-3 text-sm font-bold text-right">{formatRupiah(inv.nominal)}</td>
                <td className="px-4 py-3">
                  <button onClick={() => handleStatusToggle(inv)}>
                    <Badge color={inv.status === 'lunas' ? 'green' : 'gray'}>{inv.status === 'lunas' ? 'LUNAS' : 'PENDING'}</Badge>
                  </button>
                </td>
                <td className="px-4 py-3">
                  <button onClick={() => handleDelete(inv.id)} className="p-1 hover:bg-red-50 rounded text-red-400">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal Buat Invoice */}
      <Modal open={showModal} onClose={() => setShowModal(false)} title="Buat Tagihan Baru">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Input label="Tanggal Invoice" type="date" value={form.tanggal_invoice} onChange={e => setForm({ ...form, tanggal_invoice: e.target.value })} />
            <Input label="Jatuh Tempo" type="date" value={form.jatuh_tempo} onChange={e => setForm({ ...form, jatuh_tempo: e.target.value })} />
          </div>
          <Select label="Keterangan Termin" value={form.keterangan_termin} onChange={e => setForm({ ...form, keterangan_termin: e.target.value })}>
            {TERMIN_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
          </Select>
          <div>
            <label className="text-xs font-semibold text-gray-600 uppercase">Mode Harga</label>
            <div className="flex gap-2 mt-1">
              <button onClick={() => setForm({ ...form, mode_harga: 'persen' })} className={`flex-1 py-2 rounded-lg text-sm font-medium border ${form.mode_harga === 'persen' ? 'bg-primary text-white border-primary' : 'border-gray-300 text-gray-600'}`}>% Persentase</button>
              <button onClick={() => setForm({ ...form, mode_harga: 'manual' })} className={`flex-1 py-2 rounded-lg text-sm font-medium border ${form.mode_harga === 'manual' ? 'bg-primary text-white border-primary' : 'border-gray-300 text-gray-600'}`}>Rp Manual</button>
            </div>
          </div>
          {form.mode_harga === 'persen' ? (
            <div>
              <Input label={`Persentase (%) — Sisa: ${sisaPlafon.toFixed(1)}%`} type="number" min={0} max={100} value={form.persentase} onChange={e => setForm({ ...form, persentase: e.target.value })} />
              <p className="text-xs text-gray-500 mt-1">Nominal: {formatRupiah(totalRab * form.persentase / 100)}</p>
            </div>
          ) : (
            <Input label="Nominal (Rp)" type="number" value={form.nominal} onChange={e => setForm({ ...form, nominal: e.target.value })} />
          )}
          <Button onClick={handleSubmit} className="w-full justify-center" size="lg">SIMPAN INVOICE</Button>
        </div>
      </Modal>
    </Layout>
  );
}
