import { useEffect, useState } from 'react';
import { Printer } from 'lucide-react';
import toast from 'react-hot-toast';
import Layout from '../../components/layout/Layout';
import { Button, Modal, Badge, EmptyState } from '../../components/ui';
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
    const bobot = totalRab > 0 ? (i.subtotal / totalRab) : 0;
    return s + bobot * (i.progress_fisik || 0) / 100;
  }, 0) * 100;

  const nilaiSelesai = items.reduce((s, i) => {
    return s + i.subtotal * (i.progress_fisik || 0) / 100;
  }, 0);
  const nilaiSisa = totalRab - nilaiSelesai;
  const itemSelesai = items.filter(i => i.progress_fisik >= 100).length;
  const itemBerjalan = items.filter(i => i.progress_fisik > 0 && i.progress_fisik < 100).length;

  const handleUpdate = async () => {
    await api.put(`/progress/${activeProject.id}/items/${selected.id}`, { progress_fisik: newPct });
    toast.success('Progress diperbarui');
    setShowModal(false);
    load();
  };

  if (!activeProject) return <Layout title="Progress"><EmptyState icon="🔄" title="Pilih proyek aktif" /></Layout>;

  return (
    <Layout title="Progress Pekerjaan">
      <div className="flex items-start justify-between mb-5">
        <h2 className="font-bold text-navy">Progress Pekerjaan</h2>
        <Button variant="outline" size="sm"><Printer className="w-4 h-4" /> Cetak Laporan</Button>
      </div>

      {/* Summary Card */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 mb-5">
        <div className="flex items-center gap-6">
          <div className="flex-shrink-0">
            <div className="w-24 h-24 relative">
              <svg viewBox="0 0 36 36" className="w-24 h-24 -rotate-90">
                <circle cx="18" cy="18" r="15.9" fill="none" stroke="#f0f0f0" strokeWidth="3" />
                <circle cx="18" cy="18" r="15.9" fill="none" stroke="#DC3545" strokeWidth="3"
                  strokeDasharray={`${totalProgress} ${100 - totalProgress}`} strokeLinecap="round" />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-sm font-black text-navy">{totalProgress.toFixed(1)}%</span>
              </div>
            </div>
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h3 className="font-bold text-navy">Total Progress Proyek</h3>
              <Badge color={totalProgress === 0 ? 'gray' : totalProgress >= 100 ? 'green' : 'red'}>
                {totalProgress === 0 ? 'Awal' : totalProgress >= 100 ? 'Selesai' : 'Sedang Berjalan'}
              </Badge>
            </div>
            <p className="text-xs text-gray-500 mb-3">Bobot progress dihitung proporsional dari nilai RAB masing-masing item</p>
            <div className="h-2 bg-gray-100 rounded-full w-full">
              <div className="h-2 bg-red-500 rounded-full transition-all" style={{ width: `${Math.min(100, totalProgress)}%` }} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {[
              { label: 'NILAI SELESAI', val: formatRupiah(nilaiSelesai) },
              { label: 'NILAI SISA', val: formatRupiah(nilaiSisa) },
              { label: 'ITEM SELESAI', val: `${itemSelesai} / ${items.length}` },
              { label: 'SEDANG JALAN', val: `${itemBerjalan} item` },
            ].map(s => (
              <div key={s.label}>
                <p className="text-xs text-gray-400 uppercase tracking-wide">{s.label}</p>
                <p className="font-bold text-navy text-sm">{s.val}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Detail Table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b"><h3 className="font-bold text-navy text-sm">Detail Progress Per Item Pekerjaan</h3></div>
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 border-b">
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 w-10">NO</th>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500">URAIAN PEKERJAAN</th>
              <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-500">NILAI RAB</th>
              <th className="text-center px-4 py-2.5 text-xs font-semibold text-gray-500">BOBOT</th>
              <th className="text-center px-4 py-2.5 text-xs font-semibold text-gray-500 w-36">PROGRESS FISIK</th>
              <th className="text-center px-4 py-2.5 text-xs font-semibold text-gray-500">KONTRIBUSI</th>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500">UPDATE</th>
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
                <tr key={item.id} className="border-b hover:bg-gray-50">
                  <td className="px-4 py-2.5 text-xs text-gray-400">{idx + 1}</td>
                  <td className="px-4 py-2.5">
                    <p className="text-sm font-medium text-navy">{item.uraian}</p>
                    <p className="text-xs text-gray-400">{item.volume} {item.satuan}</p>
                  </td>
                  <td className="px-4 py-2.5 text-sm text-right">{formatRupiah(item.subtotal)}</td>
                  <td className="px-4 py-2.5 text-center">
                    <span className="text-xs font-semibold text-blue-600">{bobot.toFixed(2)}%</span>
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-gray-100 rounded-full">
                        <div className="h-1.5 bg-primary rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-xs font-bold w-10 text-right">{pct}%</span>
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-center text-xs text-gray-500">{kontribusi.toFixed(2)}%</td>
                  <td className="px-4 py-2.5">
                    <button
                      onClick={() => { setSelected(item); setNewPct(pct); setShowModal(true); }}
                      className="text-xs bg-gray-100 hover:bg-gray-200 px-2 py-1 rounded font-medium transition-all"
                    >
                      Update
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
          {items.length > 0 && (
            <tfoot>
              <tr className="bg-navy text-white">
                <td colSpan="2" className="px-4 py-3 font-bold text-sm">AKUMULASI TOTAL</td>
                <td className="px-4 py-3 font-bold text-sm text-right">{formatRupiah(totalRab)}</td>
                <td className="px-4 py-3 font-bold text-sm text-center">100%</td>
                <td></td>
                <td className="px-4 py-3 font-bold text-sm text-center text-primary">{totalProgress.toFixed(2)}%</td>
                <td></td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      <Modal open={showModal} onClose={() => setShowModal(false)} title={selected?.uraian || 'Update Progress'} size="sm">
        {selected && (
          <div className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-gray-600 uppercase">Progress Fisik (%)</label>
              <div className="flex items-center gap-3 mt-2">
                <input type="range" min={0} max={100} value={newPct} onChange={e => setNewPct(Number(e.target.value))} className="flex-1 accent-primary" />
                <div className="flex items-center gap-1">
                  <input type="number" min={0} max={100} value={newPct} onChange={e => setNewPct(Math.min(100, Math.max(0, Number(e.target.value))))} className="input-field w-16 text-center font-bold" />
                  <span className="text-sm font-bold">%</span>
                </div>
              </div>
            </div>
            <div className="h-3 bg-gray-100 rounded-full">
              <div className="h-3 bg-primary rounded-full transition-all" style={{ width: `${newPct}%` }} />
            </div>
            <Button onClick={handleUpdate} className="w-full justify-center">SIMPAN</Button>
          </div>
        )}
      </Modal>
    </Layout>
  );
}
