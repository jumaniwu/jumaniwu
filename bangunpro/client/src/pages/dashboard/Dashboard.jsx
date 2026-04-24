import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { PlusCircle, FileText, DollarSign, TrendingUp, Receipt, RefreshCw, Package, Home, ArrowRight, BarChart2, Users, AlertCircle } from 'lucide-react';
import Layout from '../../components/layout/Layout';
import { StatCard, Card, EmptyState, Skeleton, SectionCard, Button, PageHeader } from '../../components/ui';
import { formatRupiah, formatRupiahShort } from '../../lib/rupiah';
import api from '../../lib/api';

const QUICK_ACTIONS = [
  { icon: PlusCircle, label: 'Input Pekerjaan', cat: 'RAB', to: '/rekapitulasi', color: 'text-blue-500 bg-blue-50' },
  { icon: FileText, label: 'Rekapitulasi RAB', cat: 'Laporan', to: '/rekapitulasi', color: 'text-amber-500 bg-amber-50' },
  { icon: DollarSign, label: 'Lap. Keuangan', cat: 'Keuangan', to: '/keuangan', color: 'text-emerald-500 bg-emerald-50' },
  { icon: TrendingUp, label: 'Update Kurva S', cat: 'Progress', to: '/kurva-s', color: 'text-violet-500 bg-violet-50' },
  { icon: Receipt, label: 'Invoice', cat: 'Tagihan', to: '/invoice', color: 'text-orange-500 bg-orange-50' },
  { icon: RefreshCw, label: 'Progress Harian', cat: 'Update', to: '/progress', color: 'text-pink-500 bg-pink-50' },
  { icon: Package, label: 'Material Logistik', cat: 'Logistik', to: '/logistik', color: 'text-teal-500 bg-teal-50' },
  { icon: Home, label: 'Ganti Proyek', cat: 'Proyek', to: '/data-proyek', color: 'text-red-500 bg-red-50' },
];

const DIVISI_COLORS = ['bg-blue-400', 'bg-emerald-400', 'bg-amber-400', 'bg-violet-400', 'bg-pink-400', 'bg-teal-400', 'bg-orange-400', 'bg-red-400'];

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/dashboard').then(r => setData(r.data)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <Layout title="Dashboard">
      <div className="space-y-4">
        <Skeleton className="h-36 w-full" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28" />)}
        </div>
        <Skeleton className="h-48" />
      </div>
    </Layout>
  );

  if (!data?.project) return (
    <Layout title="Dashboard">
      <EmptyState
        icon="🏗️"
        title="Belum ada proyek aktif"
        desc="Buat proyek baru untuk mulai menggunakan BangunPro"
        action={
          <Link to="/data-proyek">
            <Button><PlusCircle className="w-4 h-4" /> Buat Proyek Baru</Button>
          </Link>
        }
      />
    </Layout>
  );

  const { project, itemCount, hariBerjalan, biayaMaterial, biayaUpah, progressPct, distribusi, pareto } = data;
  const margin = 0.10;
  const totalRab = project.total_rab * (1 + margin);

  return (
    <Layout title="Dashboard">
      {/* Active Project Banner */}
      <div className="rounded-2xl p-5 sm:p-6 mb-4 text-white overflow-hidden relative"
        style={{ background: 'linear-gradient(135deg, #1A1A2E 0%, #16213E 100%)' }}>
        <div className="absolute top-0 right-0 w-40 h-40 rounded-full opacity-5"
          style={{ background: 'radial-gradient(circle, #F5A623, transparent)', transform: 'translate(30%, -30%)' }} />
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
              <span className="text-white/50 text-xs font-semibold uppercase tracking-wider">Proyek Aktif</span>
            </div>
            <h2 className="text-lg sm:text-xl font-black text-white leading-tight truncate">{project.name}</h2>
            <p className="text-white/40 text-xs mt-0.5">Mulai: {project.tanggal_mulai || '-'}</p>
            <div className="mt-4">
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="text-white/60">Realisasi Progress</span>
                <span className="font-black text-primary">{progressPct}%</span>
              </div>
              <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                <div className="h-2 bg-gradient-to-r from-amber-400 to-amber-300 rounded-full transition-all" style={{ width: `${progressPct}%` }} />
              </div>
              {project.estimasi_selesai && (
                <p className="text-white/30 text-xs mt-1.5">Estimasi selesai: {project.estimasi_selesai}</p>
              )}
            </div>
          </div>
          <div className="sm:text-right">
            <p className="text-white/40 text-xs uppercase tracking-widest font-semibold">Total RAB</p>
            <p className="text-2xl sm:text-3xl font-black text-primary mt-0.5">{formatRupiahShort(totalRab)}</p>
          </div>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <StatCard bg="dark" title="Item Pekerjaan" value={itemCount} sub="Jenis pekerjaan" />
        <StatCard bg="orange" title="Hari Berjalan" value={`${hariBerjalan} hr`} sub="Sejak mulai proyek" />
        <StatCard accent title="Biaya Material" value={formatRupiahShort(biayaMaterial)} sub="Est. material" icon={<BarChart2 className="w-4 h-4 text-blue-500" />} />
        <StatCard accent title="Biaya Upah" value={formatRupiahShort(biayaUpah)} sub="Est. upah kerja" icon={<Users className="w-4 h-4 text-emerald-500" />} />
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-4">
        {QUICK_ACTIONS.map((action) => {
          const Icon = action.icon;
          return (
            <Link key={action.label} to={action.to}
              className="bg-white rounded-2xl border border-gray-100 p-4 hover:shadow-md hover:-translate-y-0.5 transition-all group active:scale-95">
              <div className={`inline-flex p-2.5 rounded-xl mb-3 ${action.color}`}>
                <Icon className="w-4 h-4" />
              </div>
              <p className="text-gray-400 text-[10px] font-semibold uppercase tracking-wide">{action.cat}</p>
              <p className="font-bold text-[#1A1A2E] text-xs sm:text-sm leading-tight">{action.label}</p>
              <ArrowRight className="w-3.5 h-3.5 text-gray-300 group-hover:text-primary mt-1.5 transition-colors" />
            </Link>
          );
        })}
      </div>

      {/* Distribusi + Pareto */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SectionCard title="Distribusi Anggaran">
          <div className="p-5 space-y-4">
            {distribusi.filter(d => d.total > 0).length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-6">Belum ada data RAB</p>
            ) : distribusi.filter(d => d.total > 0).map((div, i) => (
              <div key={div.id}>
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className="font-semibold text-gray-700 flex-1 truncate mr-2">{div.name}</span>
                  <span className="text-gray-400">{div.item_count} item</span>
                  <span className="font-bold text-[#1A1A2E] ml-3">{formatRupiahShort(div.total)}</span>
                  <span className="text-gray-400 ml-1.5 w-9 text-right">{div.pct.toFixed(1)}%</span>
                </div>
                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div className={`h-1.5 rounded-full ${DIVISI_COLORS[i % DIVISI_COLORS.length]}`}
                    style={{ width: `${Math.min(100, div.pct)}%` }} />
                </div>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Top 5 Biaya Terbesar">
          <div className="p-5 space-y-3">
            {pareto.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-6">Belum ada data</p>
            ) : pareto.map((item) => (
              <div key={item.id}>
                <div className="flex items-center gap-3 mb-1.5">
                  <span className="w-6 h-6 rounded-lg bg-red-50 text-red-500 text-xs font-black flex items-center justify-center flex-shrink-0">
                    {item.rank}
                  </span>
                  <span className="text-xs text-gray-700 flex-1 truncate leading-tight">{item.uraian}</span>
                  <span className="font-black text-red-500 text-xs whitespace-nowrap">{formatRupiahShort(item.subtotal)}</span>
                  <span className="text-gray-400 text-xs w-10 text-right">{item.pct.toFixed(1)}%</span>
                </div>
                <div className="h-1 bg-gray-100 rounded-full overflow-hidden ml-9">
                  <div className="h-1 bg-red-300 rounded-full" style={{ width: `${Math.min(100, item.pct)}%` }} />
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>
    </Layout>
  );
}
