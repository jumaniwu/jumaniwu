import { Link } from 'react-router-dom';
import { CheckCircle } from 'lucide-react';

const FEATURES = [
  'Unlimited proyek',
  'RAB dengan AHSP SNI 2024',
  'Kurva S & monitoring progress',
  'Invoice & termin bertahap',
  'Logistik & kebutuhan material',
  'Kas & realisasi biaya',
  'Master harga per wilayah',
  'Export PDF & Excel',
  'Update seumur hidup',
];

export default function Pricing() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-navy to-slate-800 flex flex-col items-center justify-center p-8">
      <div className="text-center mb-8">
        <Link to="/" className="font-black text-white text-2xl">BANGUNPRO</Link>
        <p className="text-white/60 mt-2">Pilih paket terbaik untuk bisnis Anda</p>
      </div>

      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 relative">
        <div className="absolute -top-4 left-1/2 -translate-x-1/2">
          <span className="bg-primary text-white text-xs font-black px-4 py-1.5 rounded-full">HEMAT 34%</span>
        </div>

        <h2 className="text-2xl font-black text-navy text-center mt-2">LIFETIME ACCESS</h2>
        <div className="text-center my-6">
          <span className="text-gray-400 line-through text-lg">Rp 297.000</span>
          <div className="text-5xl font-black text-primary mt-1">Rp 197.000</div>
          <p className="text-gray-500 text-sm mt-1">Bayar sekali, pakai selamanya</p>
        </div>

        <div className="space-y-3 mb-8">
          {FEATURES.map(f => (
            <div key={f} className="flex items-center gap-3">
              <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
              <span className="text-gray-700 text-sm">{f}</span>
            </div>
          ))}
        </div>

        <Link to="/register" className="block w-full bg-primary text-white text-center py-4 rounded-xl font-black text-lg hover:bg-primary-dark transition-all">
          BELI SEKARANG — Rp 197.000
        </Link>

        <p className="text-center text-xs text-gray-400 mt-4">Pembayaran via Transfer Bank / QRIS</p>
        <p className="text-center text-xs text-gray-400">Atau <Link to="/register" className="text-primary hover:underline">coba gratis 8 jam</Link> terlebih dahulu</p>
      </div>
    </div>
  );
}
