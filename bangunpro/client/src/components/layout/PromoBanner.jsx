import { useState, useEffect } from 'react';
import { X, Zap } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

const PROMO_HOURS = 8;

function getCountdown() {
  let start = localStorage.getItem('promoStartTime');
  if (!start) {
    start = Date.now().toString();
    localStorage.setItem('promoStartTime', start);
  }
  const elapsed = Date.now() - parseInt(start);
  const remaining = Math.max(0, PROMO_HOURS * 3600 * 1000 - elapsed);
  const h = Math.floor(remaining / 3600000);
  const m = Math.floor((remaining % 3600000) / 60000);
  const s = Math.floor((remaining % 60000) / 1000);
  return { h, m, s, remaining };
}

export default function PromoBanner() {
  const { user, tenant } = useAuth();
  const [countdown, setCountdown] = useState({ h: 7, m: 55, s: 51, remaining: 1 });
  const [dismissed, setDismissed] = useState(false);

  const isDemo = user?.is_demo === 1;
  const isTrial = tenant?.plan === 'trial';

  useEffect(() => {
    if (!isDemo && !isTrial) return;
    const tick = () => setCountdown(getCountdown());
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [isDemo, isTrial]);

  if ((!isDemo && !isTrial) || dismissed) return null;

  const pad = n => String(n).padStart(2, '0');

  return (
    <div className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-2.5"
      style={{ background: 'linear-gradient(90deg, #7c3aed 0%, #ec4899 100%)' }}>
      <div className="flex items-center gap-3 flex-1">
        <Zap className="w-4 h-4 text-yellow-300 flex-shrink-0" />
        <span className="text-white text-xs font-bold">PROMO TERBATAS: AKSES LIFETIME</span>
        <span className="text-white/80 text-xs hidden sm:block">— Beli lisensi seumur hidup hanya Rp197.000. Promo berakhir dalam</span>
        <span className="font-mono font-bold text-yellow-300 text-sm">
          {pad(countdown.h)}:{pad(countdown.m)}:{pad(countdown.s)}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <a href="/pricing" className="bg-yellow-400 text-navy text-xs font-bold px-3 py-1.5 rounded-lg hover:bg-yellow-300 transition-all whitespace-nowrap">
          AMBIL DISKON
        </a>
        <button onClick={() => setDismissed(true)} className="text-white/60 hover:text-white ml-2">
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
