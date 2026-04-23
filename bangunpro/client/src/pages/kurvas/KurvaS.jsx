import { useEffect, useState } from 'react';
import { Printer, Edit2, BarChart2 } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Area, AreaChart } from 'recharts';
import toast from 'react-hot-toast';
import Layout from '../../components/layout/Layout';
import { Button, Modal, Badge, EmptyState } from '../../components/ui';
import { formatRupiah } from '../../lib/rupiah';
import api from '../../lib/api';
import { useProject } from '../../context/ProjectContext';

const WEEKS = Array.from({ length: 52 }, (_, i) => i + 1);

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

  const chartData = WEEKS.filter(w => {
    const row = data.find(d => d.minggu === w);
    return row && (row.plan_pct > 0 || row.realisasi_pct > 0);
  }).map(w => {
    const row = data.find(d => d.minggu === w) || {};
    return { name: `Mgg-${w}`, Plan: row.plan_pct || 0, Realisasi: row.realisasi_pct || 0 };
  });

  const latest = data.length > 0 ? data[data.length - 1] : null;
  const deviasi = latest ? (latest.realisasi_pct - latest.plan_pct) : 0;

  const handleSave = async () => {
    await api.put(`/kurvas/${activeProject.id}`, { rows: editRows });
    toast.success('Data Kurva S disimpan');
    setShowUpdate(false);
    load();
  };

  const margin = 0.10;
  const totalRabWithMargin = totalRab * (1 + margin);

  const tableRows = data.sort((a, b) => a.minggu - b.minggu);

  if (!activeProject) return <Layout title="Kurva S"><EmptyState icon="📈" title="Pilih proyek aktif" /></Layout>;

  return (
    <Layout title="Monitoring S-Curve">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h2 className="font-bold text-navy">Monitoring S-Curve</h2>
          <p className="text-xs text-gray-500">{activeProject.name} — Visualisasi progres realisasi aktual vs. rencana target</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowSimulasi(true)}><BarChart2 className="w-4 h-4" /> Simulasi Termin</Button>
          <Button size="sm" onClick={() => setShowUpdate(true)}><Edit2 className="w-4 h-4" /> Update Progress</Button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-5 mb-5">
        {/* Chart */}
        <div className="col-span-2 bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-navy text-sm">KURVA S (PLAN VS ACTUAL)</h3>
            <span className="text-xs text-gray-400">Max 52 Minggu</span>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="plan" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#94a3b8" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#94a3b8" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="real" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#F5A623" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#F5A623" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} domain={[0, 100]} tickFormatter={v => `${v}%`} />
              <Tooltip formatter={(v) => `${v}%`} />
              <Legend />
              <Area type="monotone" dataKey="Plan" stroke="#94a3b8" strokeDasharray="5 5" fill="url(#plan)" dot={false} />
              <Area type="monotone" dataKey="Realisasi" stroke="#F5A623" strokeWidth={2} fill="url(#real)" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Info Card */}
        <div className="bg-navy rounded-xl p-5 text-white">
          <p className="text-white/60 text-xs uppercase tracking-wide mb-1">Progress Terkini</p>
          {latest ? (
            <>
              <p className="text-3xl font-black text-primary mb-4">Mgg-{latest.minggu}</p>
              <p className="text-white/60 text-xs uppercase tracking-wide mb-1">Deviasi Progress</p>
              <div className="flex items-center gap-2 mb-1">
                <span className={`text-2xl font-black ${deviasi >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {deviasi >= 0 ? '+' : ''}{deviasi.toFixed(1)}%
                </span>
                <Badge color={deviasi >= 0 ? 'green' : 'red'}>{deviasi >= 0 ? 'MAJU' : 'LAMBAT'}</Badge>
              </div>
              <p className="text-white/50 text-xs">
                {deviasi < 0 ? 'Proyek berjalan lebih lambat dari rencana.' : 'Proyek berjalan sesuai atau lebih cepat dari rencana.'}
              </p>
            </>
          ) : (
            <p className="text-white/40 text-sm">Belum ada data progress</p>
          )}

          <div className="border-t border-white/10 mt-6 pt-4">
            <p className="text-white/60 text-xs uppercase tracking-wide mb-1">Kontrak Penawaran</p>
            <p className="text-xl font-bold text-white">{formatRupiah(totalRabWithMargin)}</p>
          </div>
        </div>
      </div>

      {/* Detail Table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b"><h3 className="font-bold text-navy text-sm">Rincian Progress Kumulatif</h3></div>
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 border-b">
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500">MINGGU KE</th>
              <th className="text-center px-4 py-2.5 text-xs font-semibold text-gray-500">TARGET PLAN (%)</th>
              <th className="text-center px-4 py-2.5 text-xs font-semibold text-gray-500">REALISASI AKTUAL (%)</th>
              <th className="text-center px-4 py-2.5 text-xs font-semibold text-gray-500">DEVIASI (+/-)</th>
            </tr>
          </thead>
          <tbody>
            {tableRows.length === 0 ? (
              <tr><td colSpan="4" className="text-center py-8 text-gray-400 text-sm">Belum ada data. Klik "Update Progress" untuk mengisi.</td></tr>
            ) : tableRows.map(row => {
              const dev = row.realisasi_pct - row.plan_pct;
              return (
                <tr key={row.id} className="border-b hover:bg-gray-50">
                  <td className="px-4 py-2.5 text-sm font-medium">Minggu - {row.minggu}</td>
                  <td className="px-4 py-2.5 text-sm text-center">{row.plan_pct}%</td>
                  <td className="px-4 py-2.5 text-sm text-center font-semibold text-primary">{row.realisasi_pct}%</td>
                  <td className="px-4 py-2.5 text-center">
                    <span className={`text-sm font-bold ${dev >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                      {dev >= 0 ? '+' : ''}{dev.toFixed(1)}%
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Update Modal */}
      <Modal open={showUpdate} onClose={() => setShowUpdate(false)} title="Update Data Progress Kurva-S" size="xl">
        <p className="text-xs text-blue-600 bg-blue-50 p-3 rounded-lg mb-4">
          💡 Masukkan nilai kumulatif. Contoh: Jika minggu-1 10% dan minggu-2 nambah 5%, input minggu-2 adalah 15%.
        </p>
        <div className="max-h-96 overflow-y-auto">
          <table className="w-full">
            <thead className="sticky top-0 bg-white">
              <tr className="border-b">
                <th className="text-left px-3 py-2 text-xs">MINGGU</th>
                <th className="text-left px-3 py-2 text-xs">PLAN (%)</th>
                <th className="text-left px-3 py-2 text-xs text-blue-600">REALISASI (%)</th>
              </tr>
            </thead>
            <tbody>
              {editRows.map((row, i) => (
                <tr key={row.minggu} className="border-b">
                  <td className="px-3 py-1.5 text-sm text-gray-600">Mgg {row.minggu}</td>
                  <td className="px-3 py-1.5">
                    <input type="number" min={0} max={100} value={row.plan_pct} onChange={e => {
                      const nr = [...editRows]; nr[i] = { ...nr[i], plan_pct: Number(e.target.value) }; setEditRows(nr);
                    }} className="input-field text-xs w-20" />
                  </td>
                  <td className="px-3 py-1.5">
                    <input type="number" min={0} max={100} value={row.realisasi_pct} onChange={e => {
                      const nr = [...editRows]; nr[i] = { ...nr[i], realisasi_pct: Number(e.target.value) }; setEditRows(nr);
                    }} className="input-field text-xs w-20 border-blue-300 focus:border-blue-500" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Button onClick={handleSave} className="w-full justify-center mt-4" variant="dark">SIMPAN DATA PROGRESS</Button>
      </Modal>

      {/* Simulasi Termin Modal */}
      <Modal open={showSimulasi} onClose={() => setShowSimulasi(false)} title="Simulasi Termin Pembayaran">
        <div className="space-y-3">
          <div className="text-center mb-4">
            <p className="text-xs text-gray-500 uppercase">Nilai Proyek (Termasuk Margin)</p>
            <p className="text-2xl font-black text-navy">{formatRupiah(totalRabWithMargin)}</p>
          </div>
          {[
            { label: 'DP (30%)', pct: 30, color: 'blue' },
            { label: 'Termin 1 (30%)', pct: 30, color: 'blue' },
            { label: 'Termin 2 (35%)', pct: 35, color: 'blue' },
            { label: 'Retensi (5%)', pct: 5, color: 'green' },
          ].map(t => (
            <div key={t.label} className={`flex justify-between items-center p-3 rounded-lg ${t.color === 'green' ? 'bg-green-50' : 'bg-blue-50'}`}>
              <span className="font-semibold text-sm">{t.label}</span>
              <span className={`font-bold ${t.color === 'green' ? 'text-green-700' : 'text-blue-700'}`}>{formatRupiah(totalRabWithMargin * t.pct / 100)}</span>
            </div>
          ))}
          <Button variant="outline" onClick={() => setShowSimulasi(false)} className="w-full justify-center mt-4">TUTUP</Button>
        </div>
      </Modal>
    </Layout>
  );
}
