import { useState, useEffect } from 'react';
import { X, Zap } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

const PROMO_HOURS = 8;

function getCountdown() {
  let start = localStorage.getItem('promoStartTime');
  if (!start) { start = Date.now().toString(); localStorage.setItem('promoStartTime', start); }
  const elapsed = Date.now() - parseInt(start);
  const remaining = Math.max(0, PROMO_HOURS * 3600 * 1000 - elapsed);
  const h = Math.floor(remaining / 3600000);
  const m = Math.floor((remaining % 3600000) / 60000);
  const s = Math.floor((remaining % 60000) / 1000);
  return { h, m, s, remaining };
}

export const BANNER_H = 40;

export default function PromoBanner({ onDismiss }) {
  const { user, tenant } = useAuth();
  const [countdown, setCountdown] = useState(getCountdown());
  const [dismissed, setDismissed] = useState(false);
  const isDemo = user?.is_demo === 1 || tenant?.plan === 'trial';

  useEffect(() => {
    if (!isDemo) return;
    const id = setInterval(() => setCountdown(getCountdown()), 1000);
    return () => clearInterval(id);
  }, [isDemo]);

  if (!isDemo || dismissed) return null;

  const pad = n => String(n).padStart(2, '0');

  const handleDismiss = () => { setDismissed(true); if (onDismiss) onDismiss(); };

  return (
    <div className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4 gap-2"
      style={{ height: BANNER_H, background: 'linear-gradient(90deg, #7c3aed, #db2777)' }}>
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <Zap className="w-3.5 h-3.5 text-yellow-300 flex-shrink-0" />
        <span className="text-white text-xs font-bold hidden sm:block whitespace-nowrap">PROMO TERBATAS</span>
        <span className="text-white/70 text-xs hidden md:block">— Lifetime access Rp197.000 berakhir dalam</span>
        <span className="font-mono font-black text-yellow-300 text-sm tracking-wider">
          {pad(countdown.h)}:{pad(countdown.m)}:{pad(countdown.s)}
        </span>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <a href="/pricing"
          className="bg-yellow-400 text-[#1A1A2E] text-xs font-black px-3 py-1.5 rounded-lg hover:bg-yellow-300 transition-all whitespace-nowrap">
          AMBIL DISKON
        </a>
        <button onClick={handleDismiss} className="text-white/50 hover:text-white p-0.5 transition-colors">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
