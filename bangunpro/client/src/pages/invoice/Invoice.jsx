import { useEffect, useState } from 'react';
import { Printer, Plus, Trash2, CheckCircle, Clock } from 'lucide-react';
import toast from 'react-hot-toast';
import Layout from '../../components/layout/Layout';
import { Button, Modal, Badge, EmptyState, PageHeader, SectionCard, Input, Select } from '../../components/ui';
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
    const [invRes, rabRes] = await Promise.all([api.get(`/invoice/${activeProject.id}`), api.get(`/rab/${activeProject.id}/summary`)]);
    setInvoices(invRes.data);
    setTotalRab(rabRes.data.total || 0);
  };

  useEffect(() => { load(); }, [activeProject]);

  const totalTagih = invoices.reduce((s, i) => s + i.nominal, 0);
  const totalLunas = invoices.filter(i => i.status === 'lunas').reduce((s, i) => s + i.nominal, 0);
  const pctTagih = totalRab > 0 ? (totalTagih / totalRab * 100) : 0;

  const handleSubmit = async () => {
    if (!form.tanggal_invoice) return toast.error('Tanggal wajib diisi');
    await api.post(`/invoice/${activeProject.id}`, form);
    toast.success('Invoice dibuat!');
    setShowModal(false);
    setForm({ tanggal_invoice: '', jatuh_tempo: '', keterangan_termin: TERMIN_OPTIONS[0], mode_harga: 'persen', persentase: 0, nominal: 0 });
    load();
  };

  if (!activeProject) return <Layout title="Invoice"><EmptyState icon="🧾" title="Pilih proyek aktif" /></Layout>;

  return (
    <Layout title="Invoice & Termin">
      <PageHeader title="Invoice & Termin" sub="Kelola penagihan bertahap."
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm"><Printer className="w-4 h-4" /></Button>
            <Button onClick={() => setShowModal(true)} size="sm"><Plus className="w-4 h-4" /> Buat Invoice</Button>
          </div>
        }
      />

      {/* Summary */}
      <div className="rounded-2xl p-5 mb-4 text-white" style={{ background: '#1A1A2E' }}>
        <div className="grid grid-cols-3 gap-4 mb-4">
          {[
            { label: 'Total RAB', val: formatRupiah(totalRab), color: 'text-white' },
            { label: 'Total Tagihan', val: formatRupiah(totalTagih), color: 'text-primary' },
            { label: 'Sudah Lunas', val: formatRupiah(totalLunas), color: 'text-emerald-400' },
          ].map(s => (
            <div key={s.label}>
              <p className="text-white/40 text-xs font-semibold uppercase">{s.label}</p>
              <p className={`font-black text-sm sm:text-base mt-0.5 ${s.color}`}>{s.val}</p>
            </div>
          ))}
        </div>
        <div className="flex justify-between text-xs text-white/50 mb-1.5">
          <span>Progress Penagihan: {pctTagih.toFixed(1)}%</span>
          <span className="text-red-300">Sisa Plafon: {Math.max(0, 100 - pctTagih).toFixed(1)}%</span>
        </div>
        <div className="h-2.5 bg-white/10 rounded-full overflow-hidden">
          <div className="h-2.5 bg-gradient-to-r from-primary to-amber-300 rounded-full transition-all"
            style={{ width: `${Math.min(100, pctTagih)}%` }} />
        </div>
      </div>

      <SectionCard title={`Daftar Invoice (${invoices.length})`}>
        <div className="overflow-x-auto">
          <table className="tbl">
            <thead>
              <tr>
                <th>No. Invoice</th>
                <th>Keterangan Termin</th>
                <th className="hidden sm:table-cell">Tgl Invoice</th>
                <th className="text-right">Nominal</th>
                <th>Status</th>
                <th className="w-12"></th>
              </tr>
            </thead>
            <tbody>
              {invoices.length === 0 ? (
                <tr><td colSpan="6" className="text-center py-12 text-gray-400 text-sm">
                  Belum ada invoice. Klik "+ Buat Invoice" untuk memulai.
                </td></tr>
              ) : invoices.map(inv => (
                <tr key={inv.id}>
                  <td className="font-mono text-xs text-gray-500">{inv.no_invoice}</td>
                  <td className="font-semibold text-[#1A1A2E]">{inv.keterangan_termin}</td>
                  <td className="hidden sm:table-cell text-gray-500">{inv.tanggal_invoice}</td>
                  <td className="font-black text-right">{formatRupiah(inv.nominal)}</td>
                  <td>
                    <button onClick={() => api.put(`/invoice/${inv.id}`, { status: inv.status === 'lunas' ? 'pending' : 'lunas' }).then(() => load())}>
                      <Badge color={inv.status === 'lunas' ? 'green' : 'gray'}>
                        {inv.status === 'lunas' ? <><CheckCircle className="w-3 h-3 mr-1" />LUNAS</> : <><Clock className="w-3 h-3 mr-1" />PENDING</>}
                      </Badge>
                    </button>
                  </td>
                  <td>
                    <button onClick={() => api.delete(`/invoice/${inv.id}`).then(() => { toast.success('Dihapus'); load(); })}
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

      <Modal open={showModal} onClose={() => setShowModal(false)} title="Buat Invoice Baru">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Input label="Tanggal Invoice" type="date" value={form.tanggal_invoice} onChange={e => setForm({ ...form, tanggal_invoice: e.target.value })} />
            <Input label="Jatuh Tempo" type="date" value={form.jatuh_tempo} onChange={e => setForm({ ...form, jatuh_tempo: e.target.value })} />
          </div>
          <Select label="Keterangan Termin" value={form.keterangan_termin} onChange={e => setForm({ ...form, keterangan_termin: e.target.value })}>
            {TERMIN_OPTIONS.map(t => <option key={t}>{t}</option>)}
          </Select>
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5 block">Mode Harga</label>
            <div className="grid grid-cols-2 gap-2">
              {['persen', 'manual'].map(m => (
                <button key={m} type="button" onClick={() => setForm({ ...form, mode_harga: m })}
                  className={`py-2.5 rounded-xl text-sm font-bold border-2 transition-all ${form.mode_harga === m ? 'border-primary bg-primary/5 text-primary' : 'border-gray-200 text-gray-500'}`}>
                  {m === 'persen' ? '% Persentase' : 'Rp Manual'}
                </button>
              ))}
            </div>
          </div>
          {form.mode_harga === 'persen' ? (
            <Input label={`Persentase — Sisa: ${Math.max(0, 100 - pctTagih).toFixed(1)}%`} type="number" min={0} max={100}
              value={form.persentase} onChange={e => setForm({ ...form, persentase: e.target.value })}
              hint={`Nominal: ${formatRupiah(totalRab * form.persentase / 100)}`} />
          ) : (
            <Input label="Nominal (Rp)" type="number" value={form.nominal} onChange={e => setForm({ ...form, nominal: e.target.value })} />
          )}
          <Button onClick={handleSubmit} className="w-full justify-center" size="lg">SIMPAN INVOICE</Button>
        </div>
      </Modal>
    </Layout>
  );
}
