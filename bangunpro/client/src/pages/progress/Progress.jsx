import { useEffect, useState } from 'react';
import { Printer } from 'lucide-react';
import toast from 'react-hot-toast';
import Layout from '../../components/layout/Layout';
import { Button, Modal, Badge, EmptyState, PageHeader, SectionCard } from '../../components/ui';
import { formatRupiah } from '../../lib/rupiah';
import api from '../../lib/api';
import { useProject } from '../../context/ProjectContext';

export default function Progress() {
  const { activeProject } = useProject();
  const [items, setItems] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [selected, setSelected] = useState(null);
  const [newPct, setNewPct] = useState(0);

  const load = async () => {
    if (!activeProject) return;
    const r = await api.get(`/progress/${activeProject.id}`);
    setItems(r.data);
  };

  useEffect(() => { load(); }, [activeProject]);

  const totalRab = items.reduce((s, i) => s + i.subtotal, 0);
  const totalProgress = items.reduce((s, i) => {
    return s + (totalRab > 0 ? i.subtotal / totalRab : 0) * (i.progress_fisik || 0) / 100;
  }, 0) * 100;
  const nilaiSelesai = items.reduce((s, i) => s + i.subtotal * (i.progress_fisik || 0) / 100, 0);
  const nilaiSisa = totalRab - nilaiSelesai;
  const itemSelesai = items.filter(i => i.progress_fisik >= 100).length;
  const itemBerjalan = items.filter(i => i.progress_fisik > 0 && i.progress_fisik < 100).length;

  const handleUpdate = async () => {
    await api.put(`/progress/${activeProject.id}/items/${selected.id}`, { progress_fisik: newPct });
    toast.success('Progress diperbarui');
    setShowModal(false); load();
  };

  const STATS = [
    { label: 'NILAI SELESAI', val: formatRupiah(nilaiSelesai), color: 'text-emerald-600' },
    { label: 'NILAI SISA', val: formatRupiah(nilaiSisa), color: 'text-red-500' },
    { label: 'ITEM SELESAI', val: `${itemSelesai} / ${items.length}`, color: 'text-[#1A1A2E]' },
    { label: 'SEDANG JALAN', val: `${itemBerjalan} item`, color: 'text-amber-600' },
  ];

  if (!activeProject) return <Layout title="Progress"><EmptyState icon="🔄" title="Pilih proyek aktif" /></Layout>;

  return (
    <Layout title="Progress Pekerjaan">
      <PageHeader title="Progress Pekerjaan"
        actions={<Button variant="outline" size="sm"><Printer className="w-4 h-4" /><span className="hidden sm:inline">Cetak</span></Button>}
      />

      {/* Summary */}
      <div className="card p-5 mb-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-5">
          {/* Donut */}
          <div className="flex-shrink-0 flex items-center gap-4">
            <div className="relative w-24 h-24">
              <svg viewBox="0 0 36 36" className="w-24 h-24 -rotate-90">
                <circle cx="18" cy="18" r="15.9" fill="none" stroke="#f3f4f6" strokeWidth="3.5" />
                <circle cx="18" cy="18" r="15.9" fill="none"
                  stroke={totalProgress >= 80 ? '#10b981' : totalProgress >= 40 ? '#F5A623' : '#ef4444'}
                  strokeWidth="3.5"
                  strokeDasharray={`${Math.min(100, totalProgress)} ${100 - Math.min(100, totalProgress)}`}
                  strokeLinecap="round" />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-lg font-black text-[#1A1A2E]">{totalProgress.toFixed(0)}%</span>
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-bold text-[#1A1A2E]">Progress Proyek</h3>
                <Badge color={totalProgress === 0 ? 'gray' : totalProgress >= 100 ? 'green' : 'orange'}>
                  {totalProgress === 0 ? 'Belum mulai' : totalProgress >= 100 ? 'Selesai' : 'Berjalan'}
                </Badge>
              </div>
              <p className="text-xs text-gray-400">Bobot proporsional dari nilai RAB</p>
            </div>
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-2 gap-3 flex-1">
            {STATS.map(s => (
              <div key={s.label} className="bg-gray-50 rounded-xl p-3">
                <p className="text-[10px] text-gray-400 uppercase tracking-wide font-semibold">{s.label}</p>
                <p className={`font-black text-sm mt-0.5 ${s.color}`}>{s.val}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Table */}
      <SectionCard title="Detail Progress Per Item">
        <div className="overflow-x-auto">
          <table className="tbl">
            <thead>
              <tr>
                <th className="w-8">No</th>
                <th>Uraian Pekerjaan</th>
                <th className="text-right hidden sm:table-cell">Nilai RAB</th>
                <th className="text-center hidden md:table-cell">Bobot</th>
                <th className="text-center">Progress</th>
                <th className="text-center hidden lg:table-cell">Kontribusi</th>
                <th className="w-20">Update</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr><td colSpan="7" className="text-center py-12 text-gray-400">Belum ada item RAB</td></tr>
              ) : items.map((item, idx) => {
                const bobot = totalRab > 0 ? (item.subtotal / totalRab * 100) : 0;
                const pct = item.progress_fisik || 0;
                const kontribusi = bobot * pct / 100;
                return (
                  <tr key={item.id}>
                    <td className="text-gray-400 text-xs">{idx + 1}</td>
                    <td>
                      <p className="font-semibold text-[#1A1A2E] text-sm leading-tight">{item.uraian}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{item.volume} {item.satuan}</p>
                    </td>
                    <td className="text-right hidden sm:table-cell">{formatRupiah(item.subtotal)}</td>
                    <td className="text-center hidden md:table-cell">
                      <span className="text-xs font-bold text-blue-500 bg-blue-50 px-1.5 py-0.5 rounded-lg">{bobot.toFixed(2)}%</span>
                    </td>
                    <td>
                      <div className="flex items-center gap-2 min-w-28">
                        <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div className={`h-2 rounded-full transition-all ${pct >= 100 ? 'bg-emerald-400' : pct > 0 ? 'bg-primary' : 'bg-gray-200'}`}
                            style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-xs font-black w-8 text-right text-[#1A1A2E]">{pct}%</span>
                      </div>
                    </td>
                    <td className="text-center text-xs text-gray-400 hidden lg:table-cell">{kontribusi.toFixed(2)}%</td>
                    <td>
                      <button onClick={() => { setSelected(item); setNewPct(pct); setShowModal(true); }}
                        className="text-xs bg-primary/10 hover:bg-primary/20 text-primary px-2.5 py-1.5 rounded-lg font-bold transition-all active:scale-95">
                        Update
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            {items.length > 0 && (
              <tfoot>
                <tr style={{ background: '#1A1A2E' }} className="text-white">
                  <td colSpan="2" className="px-4 py-3 font-bold text-sm">AKUMULASI TOTAL</td>
                  <td className="px-4 py-3 font-bold text-sm text-right hidden sm:table-cell">{formatRupiah(totalRab)}</td>
                  <td className="px-4 py-3 text-center hidden md:table-cell text-sm font-bold">100%</td>
                  <td className="px-4 py-3"></td>
                  <td className="px-4 py-3 text-center text-primary font-black hidden lg:table-cell">{totalProgress.toFixed(2)}%</td>
                  <td className="px-4 py-3"></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </SectionCard>

      <Modal open={showModal} onClose={() => setShowModal(false)} title="Update Progress" size="sm">
        {selected && (
          <div className="space-y-5">
            <p className="text-sm font-semibold text-gray-700 bg-gray-50 rounded-xl p-3">{selected.uraian}</p>
            <div>
              <div className="flex items-center justify-between mb-3">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Progress Fisik</label>
                <div className="flex items-center gap-1.5">
                  <input type="number" min={0} max={100} value={newPct}
                    onChange={e => setNewPct(Math.min(100, Math.max(0, Number(e.target.value))))}
                    className="input w-16 text-center font-black text-lg" />
                  <span className="font-black text-[#1A1A2E]">%</span>
                </div>
              </div>
              <input type="range" min={0} max={100} value={newPct}
                onChange={e => setNewPct(Number(e.target.value))}
                className="w-full h-2 rounded-full accent-primary cursor-pointer" />
              <div className="mt-3 h-3 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-3 bg-gradient-to-r from-primary to-amber-300 rounded-full transition-all"
                  style={{ width: `${newPct}%` }} />
              </div>
            </div>
            <Button onClick={handleUpdate} className="w-full justify-center" size="lg">SIMPAN PROGRESS</Button>
          </div>
        )}
      </Modal>
    </Layout>
  );
}
