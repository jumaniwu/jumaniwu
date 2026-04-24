import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, FolderOpen, FileText, TrendingUp, DollarSign } from 'lucide-react';

const ITEMS = [
  { icon: LayoutDashboard, label: 'Dashboard', to: '/dashboard' },
  { icon: FolderOpen, label: 'Proyek', to: '/data-proyek' },
  { icon: FileText, label: 'RAB', to: '/rekapitulasi' },
  { icon: TrendingUp, label: 'Kurva S', to: '/kurva-s' },
  { icon: DollarSign, label: 'Keuangan', to: '/keuangan' },
];

export default function BottomNav() {
  const location = useLocation();

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-gray-100 shadow-lg pb-safe">
      <div className="flex">
        {ITEMS.map(item => {
          const Icon = item.icon;
          const active = location.pathname === item.to;
          return (
            <Link key={item.to} to={item.to}
              className={`flex-1 flex flex-col items-center justify-center py-2.5 transition-all ${active ? 'text-primary' : 'text-gray-400'}`}>
              <Icon className={`w-5 h-5 mb-0.5 ${active ? 'text-primary' : ''}`} />
              <span className={`text-[9px] font-semibold tracking-wide ${active ? 'text-primary' : ''}`}>{item.label}</span>
              {active && <span className="absolute bottom-0 w-1 h-1 bg-primary rounded-full" />}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
