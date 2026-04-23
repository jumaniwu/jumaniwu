import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { PlusCircle, FileText, DollarSign, TrendingUp, Receipt, RefreshCw, Package, Home, ArrowRight, BarChart2, Users } from 'lucide-react';
import Layout from '../../components/layout/Layout';
import { StatCard, Card, EmptyState, Skeleton } from '../../components/ui';
import { formatRupiah, formatRupiahShort } from '../../lib/rupiah';
import api from '../../lib/api';

const QUICK_ACTIONS = [
  { icon: PlusCircle, label: 'Input Pekerjaan', cat: 'RAB', to: '/rekapitulasi', color: 'bg-blue-50 text-blue-600' },
  { icon: FileText, label: 'Rekapitulasi RAB', cat: 'Laporan', to: '/rekapitulasi', color: 'bg-yellow-50 text-yellow-600' },
  { icon: DollarSign, label: 'Laporan Keuangan', cat: 'Keuangan', to: '/keuangan', color: 'bg-green-50 text-green-600' },
  { icon: TrendingUp, label: 'Update Kurva S', cat: 'Progress', to: '/kurva-s', color: 'bg-purple-50 text-purple-600' },
  { icon: Receipt, label: 'Invoice', cat: 'Tagihan', to: '/invoice', color: 'bg-orange-50 text-orange-600' },
  { icon: RefreshCw, label: 'Progress Harian', cat: 'Update', to: '/progress', color: 'bg-pink-50 text-pink-600' },
  { icon: Package, label: 'Material Logistik', cat: 'Logistik', to: '/logistik', color: 'bg-teal-50 text-teal-600' },
  { icon: Home, label: 'Ganti Proyek', cat: 'Proyek', to: '/data-proyek', color: 'bg-red-50 text-red-600' },
];

const DIVISI_COLORS = ['bg-blue-500', 'bg-green-500', 'bg-yellow-500', 'bg-purple-500', 'bg-pink-500', 'bg-teal-500', 'bg-orange-500', 'bg-red-500'];

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/dashboard').then(r => setData(r.data)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <Layout title="Dashboard">
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <div className="grid grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28" />)}
        </div>
      </div>
    </Layout>
  );

  if (!data?.project) return (
    <Layout title="Dashboard">
      <EmptyState icon="🏗️" title="Belum ada proyek aktif" desc="Buat proyek baru untuk mulai menggunakan BangunPro" />
      <div className="text-center mt-4">
        <Link to="/data-proyek" className="btn-primary inline-flex items-center gap-2">
          <PlusCircle className="w-4 h-4" /> Buat Proyek Baru
        </Link>
      </div>
    </Layout>
  );

  const { project, itemCount, hariBerjalan, biayaMaterial, biayaUpah, progressPct, distribusi, pareto } = data;
  const margin = 0.10;
  const totalRab = project.total_rab * (1 + margin);

  return (
    <Layout title="Dashboard">
      {/* Active Project Banner */}
      <div className="bg-navy rounded-2xl p-6 mb-6 text-white">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h2 className="text-xl font-bold">{project.name}</h2>
            <p className="text-white/60 text-sm mt-1">Mulai: {project.tanggal_mulai || '-'}</p>
            <div className="mt-3">
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-white/70">Realisasi Progress</span>
                <span className="font-bold text-primary">{progressPct}%</span>
              </div>
              <div className="h-2 bg-white/10 rounded-full">
                <div className="h-2 bg-primary rounded-full transition-all" style={{ width: `${progressPct}%` }} />
              </div>
              {project.estimasi_selesai && <p className="text-white/50 text-xs mt-1">Estimasi Selesai: {project.estimasi_selesai}</p>}
            </div>
          </div>
          <div className="text-right ml-6">
            <p className="text-white/50 text-xs uppercase tracking-wide">Total RAB</p>
            <p className="text-2xl font-black text-primary mt-1">{formatRupiahShort(totalRab)}</p>
          </div>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard bg="dark" title="Item Pekerjaan" value={itemCount} sub="Jenis pekerjaan" />
        <StatCard bg="orange" title="Hari Berjalan" value={`${hariBerjalan} hr`} sub="Sejak mulai proyek" />
        <StatCard title="Biaya Material" value={formatRupiahShort(biayaMaterial)} sub="Estimasi total material" icon={<BarChart2 className="w-5 h-5 text-blue-500" />} />
        <StatCard title="Biaya Upah" value={formatRupiahShort(biayaUpah)} sub="Estimasi total upah" icon={<Users className="w-5 h-5 text-green-500" />} />
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        {QUICK_ACTIONS.map((action) => {
          const Icon = action.icon;
          return (
            <Link key={action.to + action.label} to={action.to}
              className="bg-white rounded-xl border border-gray-100 p-4 hover:shadow-md transition-all group cursor-pointer">
              <div className={`inline-flex p-2 rounded-lg mb-3 ${action.color}`}>
                <Icon className="w-5 h-5" />
              </div>
              <p className="text-gray-400 text-xs">{action.cat}</p>
              <p className="font-semibold text-navy text-sm">{action.label}</p>
              <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-primary mt-1 transition-colors" />
            </Link>
          );
        })}
      </div>

      {/* Distribusi + Pareto */}
      <div className="grid grid-cols-2 gap-6">
        {/* Distribusi Anggaran */}
        <Card className="p-5">
          <h3 className="font-bold text-navy mb-4 flex items-center gap-2">
            <BarChart2 className="w-4 h-4 text-primary" /> Distribusi Anggaran
          </h3>
          <div className="space-y-3">
            {distribusi.filter(d => d.total > 0).map((div, i) => (
              <div key={div.id}>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="font-medium text-gray-700 truncate flex-1">{div.name}</span>
                  <span className="text-gray-500 ml-2">{div.item_count} item</span>
                  <span className="font-bold text-navy ml-3">{formatRupiahShort(div.total)}</span>
                  <span className="text-gray-400 ml-2 w-10 text-right">{div.pct.toFixed(1)}%</span>
                </div>
                <div className="h-1.5 bg-gray-100 rounded-full">
                  <div className={`h-1.5 rounded-full ${DIVISI_COLORS[i % DIVISI_COLORS.length]}`} style={{ width: `${Math.min(100, div.pct)}%` }} />
                </div>
              </div>
            ))}
            {distribusi.filter(d => d.total > 0).length === 0 && (
              <p className="text-gray-400 text-sm text-center py-4">Belum ada data RAB</p>
            )}
          </div>
        </Card>

        {/* Top 5 Pareto */}
        <Card className="p-5">
          <h3 className="font-bold text-navy mb-4">Top 5 Biaya Terbesar</h3>
          <div className="space-y-3">
            {pareto.map((item) => (
              <div key={item.id}>
                <div className="flex items-center gap-3 mb-1">
                  <span className="w-5 h-5 rounded-full bg-red-100 text-red-600 text-xs font-bold flex items-center justify-center flex-shrink-0">{item.rank}</span>
                  <span className="text-xs text-gray-700 truncate flex-1">{item.uraian}</span>
                  <span className="font-bold text-red-600 text-xs">{formatRupiahShort(item.subtotal)}</span>
                  <span className="text-gray-400 text-xs">{item.pct.toFixed(1)}%</span>
                </div>
                <div className="h-1 bg-gray-100 rounded-full ml-8">
                  <div className="h-1 bg-red-400 rounded-full" style={{ width: `${Math.min(100, item.pct)}%` }} />
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </Layout>
  );
}
