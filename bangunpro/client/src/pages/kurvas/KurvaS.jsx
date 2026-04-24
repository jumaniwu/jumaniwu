import { useEffect, useState } from 'react';
import { Edit2, BarChart2, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import toast from 'react-hot-toast';
import Layout from '../../components/layout/Layout';
import { Button, Modal, Badge, EmptyState, PageHeader, SectionCard } from '../../components/ui';
import { formatRupiah } from '../../lib/rupiah';
import api from '../../lib/api';
import { useProject } from '../../context/ProjectContext';

const WEEKS = Array.from({ length: 52 }, (_, i) => i + 1);

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-100 rounded-xl shadow-lg p-3 text-xs">
      <p className="font-bold text-gray-700 mb-1">{label}</p>
      {payload.map(p => (
        <p key={p.name} style={{ color: p.color }} className="font-semibold">{p.name}: {p.value}%</p>
      ))}
    </div>
  );
};

export default function KurvaS() {
  const { activeProject } = useProject();
  const [data, setData] = useState([]);
  const [totalRab, setTotalRab] = useState(0);
  const [showUpdate, setShowUpdate] = useState(false);
  const [showSimulasi, setShowSimulasi] = useState(false);
  const [editRows, setEditRows] = useState(WEEKS.map(w => ({ minggu: w, plan_pct: 0, realisasi_pct: 0 })));

  const load = async () => {
    if (!activeProject) return;
    const [kRes, rabRes] = await Promise.all([
      api.get(`/kurvas/${activeProject.id}`),
      api.get(`/rab/${activeProject.id}/summary`)
    ]);
    setData(kRes.data);
    setTotalRab(rabRes.data.total || 0);
    const filled = WEEKS.map(w => {
      const found = kRes.data.find(d => d.minggu === w);
      return { minggu: w, plan_pct: found?.plan_pct || 0, realisasi_pct: found?.realisasi_pct || 0 };
    });
    setEditRows(filled);
  };

  useEffect(() => { load(); }, [activeProject]);

  const chartData = data.filter(d => d.plan_pct > 0 || d.realisasi_pct > 0)
    .map(d => ({ name: `Mgg ${d.minggu}`, Plan: d.plan_pct, Realisasi: d.realisasi_pct }));

  const latest = data.length > 0 ? data[data.length - 1] : null;
  const deviasi = latest ? (latest.realisasi_pct - latest.plan_pct) : 0;

  const handleSave = async () => {
    await api.put(`/kurvas/${activeProject.id}`, { rows: editRows });
    toast.success('Data Kurva S tersimpan');
    setShowUpdate(false); load();
  };

  const totalRabWithMargin = totalRab * 1.10;

  if (!activeProject) return <Layout title="Kurva S"><EmptyState icon="📈" title="Pilih proyek aktif" /></Layout>;

  return (
    <Layout title="Monitoring S-Curve">
      <PageHeader
        title="Monitoring S-Curve"
        sub={`${activeProject.name} — Plan vs Aktual`}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowSimulasi(true)}><BarChart2 className="w-4 h-4" /><span className="hidden sm:inline">Simulasi</span></Button>
            <Button size="sm" onClick={() => setShowUpdate(true)}><Edit2 className="w-4 h-4" /><span className="hidden sm:inline">Update</span></Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
        {/* Chart */}
        <div className="lg:col-span-2 card p-5">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-[#1A1A2E] text-sm">KURVA S — PLAN VS ACTUAL</h3>
            <span className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded-lg">Max 52 Mgg</span>
          </div>
          {chartData.length === 0 ? (
            <div className="h-56 flex items-center justify-center text-gray-400 text-sm">
              Belum ada data — klik "Update Progress"
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="planGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#94a3b8" stopOpacity={0.15} /><stop offset="95%" stopColor="#94a3b8" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="realGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#F5A623" stopOpacity={0.25} /><stop offset="95%" stopColor="#F5A623" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} domain={[0, 100]} tickFormatter={v => `${v}%`} />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <Area type="monotone" dataKey="Plan" stroke="#94a3b8" strokeDasharray="5 5" fill="url(#planGrad)" dot={false} strokeWidth={1.5} />
                <Area type="monotone" dataKey="Realisasi" stroke="#F5A623" fill="url(#realGrad)" dot={false} strokeWidth={2.5} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Info */}
        <div className="rounded-2xl p-5 text-white flex flex-col gap-4" style={{ background: '#1A1A2E' }}>
          <div>
            <p className="text-white/40 text-xs uppercase tracking-widest font-semibold mb-1">Progress Terkini</p>
            {latest ? (
              <>
                <p className="text-4xl font-black text-primary">Mgg-{latest.minggu}</p>
                <div className="grid grid-cols-2 gap-3 mt-3">
                  <div className="bg-white/5 rounded-xl p-3">
                    <p className="text-white/40 text-xs">Plan</p>
                    <p className="text-white font-black text-lg">{latest.plan_pct}%</p>
                  </div>
                  <div className="bg-white/5 rounded-xl p-3">
                    <p className="text-white/40 text-xs">Realisasi</p>
                    <p className="text-primary font-black text-lg">{latest.realisasi_pct}%</p>
                  </div>
                </div>
              </>
            ) : <p className="text-white/30 text-sm">Belum ada data</p>}
          </div>

          <div className="border-t border-white/10 pt-4">
            <p className="text-white/40 text-xs uppercase tracking-widest font-semibold mb-2">Deviasi</p>
            <div className="flex items-center gap-2">
              <span className={`text-2xl font-black ${deviasi >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {deviasi >= 0 ? '+' : ''}{deviasi.toFixed(1)}%
              </span>
              <Badge color={deviasi >= 0 ? 'green' : 'red'}>
                {deviasi > 0 ? <><TrendingUp className="w-3 h-3 mr-1" />MAJU</> : deviasi < 0 ? <><TrendingDown className="w-3 h-3 mr-1" />LAMBAT</> : <><Minus className="w-3 h-3 mr-1" />SESUAI</>}
              </Badge>
            </div>
            <p className="text-white/30 text-xs mt-1">
              {deviasi < 0 ? 'Proyek lebih lambat dari rencana.' : deviasi > 0 ? 'Proyek lebih cepat dari rencana.' : 'Proyek sesuai rencana.'}
            </p>
          </div>

          <div className="border-t border-white/10 pt-4">
            <p className="text-white/40 text-xs uppercase tracking-widest font-semibold mb-1">Nilai Kontrak</p>
            <p className="text-white font-bold text-sm">{formatRupiah(totalRabWithMargin)}</p>
          </div>
        </div>
      </div>

      {/* Detail Table */}
      <SectionCard title="Rincian Progress Kumulatif">
        <div className="overflow-x-auto">
          <table className="tbl">
            <thead>
              <tr>
                <th>Minggu Ke</th>
                <th className="text-center">Target Plan (%)</th>
                <th className="text-center">Realisasi (%)</th>
                <th className="text-center">Deviasi</th>
              </tr>
            </thead>
            <tbody>
              {data.length === 0 ? (
                <tr><td colSpan="4" className="text-center py-10 text-gray-400 text-sm">Belum ada data. Klik "Update" untuk mengisi.</td></tr>
              ) : data.sort((a, b) => a.minggu - b.minggu).map(row => {
                const dev = row.realisasi_pct - row.plan_pct;
                return (
                  <tr key={row.id}>
                    <td className="font-semibold">Minggu - {row.minggu}</td>
                    <td className="text-center">{row.plan_pct}%</td>
                    <td className="text-center font-bold text-primary">{row.realisasi_pct}%</td>
                    <td className="text-center">
                      <span className={`font-bold ${dev > 0 ? 'text-emerald-500' : dev < 0 ? 'text-red-500' : 'text-gray-400'}`}>
                        {dev > 0 ? '+' : ''}{dev.toFixed(1)}%
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </SectionCard>

      {/* Update Modal */}
      <Modal open={showUpdate} onClose={() => setShowUpdate(false)} title="Update Progress Kurva-S" size="lg">
        <div className="bg-blue-50 rounded-xl p-3 mb-4 text-xs text-blue-700">
          💡 Masukkan nilai <strong>kumulatif</strong>. Contoh: minggu-1 = 10%, minggu-2 = 15% (bukan +5%)
        </div>
        <div className="overflow-y-auto max-h-80">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-white border-b">
              <tr>
                <th className="text-left py-2 px-2 text-xs text-gray-500">MINGGU</th>
                <th className="py-2 px-2 text-xs text-gray-500">PLAN (%)</th>
                <th className="py-2 px-2 text-xs text-blue-600">REALISASI (%)</th>
              </tr>
            </thead>
            <tbody>
              {editRows.map((row, i) => (
                <tr key={row.minggu} className="border-b border-gray-50">
                  <td className="py-1.5 px-2 text-gray-500 text-xs">Mgg {row.minggu}</td>
                  <td className="py-1.5 px-2">
                    <input type="number" min={0} max={100} value={row.plan_pct}
                      onChange={e => { const nr = [...editRows]; nr[i] = { ...nr[i], plan_pct: Number(e.target.value) }; setEditRows(nr); }}
                      className="input text-xs w-full" />
                  </td>
                  <td className="py-1.5 px-2">
                    <input type="number" min={0} max={100} value={row.realisasi_pct}
                      onChange={e => { const nr = [...editRows]; nr[i] = { ...nr[i], realisasi_pct: Number(e.target.value) }; setEditRows(nr); }}
                      className="input text-xs w-full border-blue-200 focus:border-blue-400" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Button onClick={handleSave} variant="dark" className="w-full justify-center mt-4">SIMPAN DATA PROGRESS</Button>
      </Modal>

      {/* Simulasi Modal */}
      <Modal open={showSimulasi} onClose={() => setShowSimulasi(false)} title="Simulasi Termin Pembayaran">
        <div className="text-center mb-5">
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Nilai Proyek (Termasuk Margin)</p>
          <p className="text-2xl font-black text-[#1A1A2E]">{formatRupiah(totalRabWithMargin)}</p>
        </div>
        <div className="space-y-3">
          {[
            { label: 'DP (30%)', pct: 30, color: 'bg-blue-50 border-blue-200 text-blue-700' },
            { label: 'Termin 1 (30%)', pct: 30, color: 'bg-blue-50 border-blue-200 text-blue-700' },
            { label: 'Termin 2 (35%)', pct: 35, color: 'bg-violet-50 border-violet-200 text-violet-700' },
            { label: 'Retensi (5%)', pct: 5, color: 'bg-emerald-50 border-emerald-200 text-emerald-700' },
          ].map(t => (
            <div key={t.label} className={`flex justify-between items-center p-3.5 rounded-xl border ${t.color}`}>
              <span className="font-semibold text-sm">{t.label}</span>
              <span className="font-black text-sm">{formatRupiah(totalRabWithMargin * t.pct / 100)}</span>
            </div>
          ))}
        </div>
        <Button variant="outline" onClick={() => setShowSimulasi(false)} className="w-full justify-center mt-5">TUTUP</Button>
      </Modal>
    </Layout>
  );
}
