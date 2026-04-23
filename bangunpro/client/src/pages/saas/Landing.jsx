import { Link } from 'react-router-dom';
import { CheckCircle, Building2, FileText, TrendingUp, DollarSign, Package, Receipt, RefreshCw, Database } from 'lucide-react';

const FEATURES = [
  { icon: FileText, label: 'RAB dengan AHSP SNI 2024', desc: 'Rencana anggaran biaya otomatis' },
  { icon: TrendingUp, label: 'Kurva S & Monitoring', desc: 'Visualisasi progres proyek' },
  { icon: Receipt, label: 'Invoice & Termin', desc: 'Penagihan bertahap profesional' },
  { icon: Package, label: 'Logistik Material', desc: 'Kebutuhan material otomatis' },
  { icon: DollarSign, label: 'Kas & Realisasi', desc: 'Catat pengeluaran proyek' },
  { icon: RefreshCw, label: 'Progress Pekerjaan', desc: 'Update progres real-time' },
  { icon: Database, label: 'Master Harga Wilayah', desc: 'Harga standar per daerah' },
  { icon: Building2, label: 'Multi Proyek', desc: 'Kelola banyak proyek sekaligus' },
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-white">
      {/* Nav */}
      <nav className="border-b px-8 py-4 flex items-center justify-between">
        <div className="font-black text-navy text-xl">BANGUNPRO</div>
        <div className="flex items-center gap-4">
          <Link to="/pricing" className="text-sm text-gray-600 hover:text-navy">Harga</Link>
          <Link to="/login" className="text-sm text-gray-600">Masuk</Link>
          <Link to="/register" className="bg-primary text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-primary-dark transition-all">Coba Gratis</Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="text-center py-20 px-8 bg-gradient-to-br from-navy to-slate-800">
        <div className="max-w-3xl mx-auto">
          <span className="bg-primary/20 text-primary text-sm font-bold px-3 py-1 rounded-full border border-primary/30 mb-6 inline-block">
            Platform Manajemen Konstruksi #1 Indonesia
          </span>
          <h1 className="text-4xl md:text-5xl font-black text-white leading-tight mb-6">
            Kelola Proyek Konstruksi<br /><span className="text-primary">Lebih Mudah & Profesional</span>
          </h1>
          <p className="text-white/70 text-lg mb-8">
            RAB, Kurva S, Invoice, Logistik — semua dalam satu platform.<br />Dirancang khusus untuk kontraktor Indonesia.
          </p>
          <div className="flex items-center justify-center gap-4">
            <Link to="/register" className="bg-primary text-white px-8 py-4 rounded-xl font-bold text-lg hover:bg-primary-dark transition-all">
              Coba Gratis 8 Jam →
            </Link>
            <Link to="/login" className="border border-white/30 text-white px-8 py-4 rounded-xl font-bold text-lg hover:bg-white/10 transition-all">
              Lihat Demo
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-16 px-8 bg-gray-50">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-black text-navy text-center mb-3">Semua Fitur yang Anda Butuhkan</h2>
          <p className="text-gray-500 text-center mb-10">Dari perencanaan anggaran hingga monitoring progres — dalam satu dashboard</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {FEATURES.map(f => {
              const Icon = f.icon;
              return (
                <div key={f.label} className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm hover:shadow-md transition-all">
                  <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center mb-3">
                    <Icon className="w-5 h-5 text-primary" />
                  </div>
                  <h3 className="font-bold text-navy text-sm">{f.label}</h3>
                  <p className="text-xs text-gray-500 mt-1">{f.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-16 px-8">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-black text-navy text-center mb-10">Dipercaya Kontraktor Indonesia</h2>
          <div className="grid grid-cols-3 gap-6">
            {[
              { name: 'Budi S.', role: 'Kontraktor Perumahan, Jakarta', text: 'BangunPro mengubah cara saya membuat RAB. Dulu 3 hari sekarang 2 jam!' },
              { name: 'Hendra K.', role: 'Owner CV. Karya Bangun, Surabaya', text: 'Invoice dan monitoring progress jadi jauh lebih profesional. Klien lebih percaya.' },
              { name: 'Siti R.', role: 'Project Manager, Bandung', text: 'Kurva S otomatis sangat membantu. Bisa pantau progress kapan saja.' },
            ].map(t => (
              <div key={t.name} className="bg-gray-50 rounded-xl p-5 border border-gray-100">
                <p className="text-gray-600 text-sm italic mb-4">"{t.text}"</p>
                <div>
                  <p className="font-bold text-navy text-sm">{t.name}</p>
                  <p className="text-xs text-gray-400">{t.role}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 px-8 bg-navy text-center">
        <h2 className="text-3xl font-black text-white mb-4">Mulai Sekarang — Gratis 8 Jam</h2>
        <p className="text-white/70 mb-8">Tidak perlu kartu kredit. Akses semua fitur langsung.</p>
        <Link to="/register" className="bg-primary text-white px-10 py-4 rounded-xl font-bold text-lg hover:bg-primary-dark transition-all">
          DAFTAR GRATIS →
        </Link>
      </section>

      {/* Footer */}
      <footer className="border-t py-8 text-center text-sm text-gray-400">
        <p>© 2026 BangunPro. Platform Manajemen Konstruksi Indonesia.</p>
      </footer>
    </div>
  );
}
