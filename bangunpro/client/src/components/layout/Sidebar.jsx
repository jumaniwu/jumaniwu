import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, FolderOpen, FileText, Receipt, Package,
  TrendingUp, DollarSign, RefreshCw, Database, FlaskConical,
  Wrench, Building2, Layers, Sun, Cog, ArrowUpRight, Home,
  LogOut, ChevronRight, X
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useProject } from '../../context/ProjectContext';

const SECTIONS = [
  { label: 'UTAMA', items: [
    { icon: LayoutDashboard, label: 'Dashboard', to: '/dashboard' },
    { icon: FolderOpen, label: 'Data Proyek', to: '/data-proyek' },
  ]},
  { label: 'ANALISA & LAPORAN', items: [
    { icon: FileText, label: 'Rekapitulasi', to: '/rekapitulasi' },
    { icon: Receipt, label: 'Invoice', to: '/invoice' },
    { icon: Package, label: 'Logistik', to: '/logistik' },
    { icon: TrendingUp, label: 'Kurva S', to: '/kurva-s' },
    { icon: DollarSign, label: 'Keuangan', to: '/keuangan' },
    { icon: RefreshCw, label: 'Progress', to: '/progress' },
  ]},
  { label: 'MASTER DATA', items: [
    { icon: Database, label: 'Master Harga', to: '/master-harga' },
    { icon: FlaskConical, label: 'Master Analisa', to: '/master-analisa' },
  ]},
  { label: 'PEKERJAAN', items: [
    { icon: Wrench, label: 'Persiapan', to: '/pekerjaan/persiapan' },
    { icon: Building2, label: 'Pondasi', to: '/pekerjaan/pondasi' },
    { icon: Layers, label: 'Beton Struktur', to: '/pekerjaan/beton-struktur' },
    { icon: Sun, label: 'Kanopi', to: '/pekerjaan/kanopi' },
    { icon: Cog, label: 'Baja Struktural', to: '/pekerjaan/baja-struktural' },
    { icon: ArrowUpRight, label: 'Tangga', to: '/pekerjaan/tangga' },
    { icon: Home, label: 'Pek. Atap', to: '/pekerjaan/pek-atap' },
  ]},
];

export default function Sidebar({ collapsed, setCollapsed, mobileOpen, setMobileOpen }) {
  const location = useLocation();
  const { logout } = useAuth();
  const { projectType, setProjectType } = useProject();

  const isActive = (to) => location.pathname === to || location.pathname.startsWith(to + '/');

  const handleNavClick = () => {
    if (mobileOpen) setMobileOpen(false);
  };

  const sidebarContent = (
    <div className="flex flex-col h-full" style={{ background: '#16213E' }}>
      {/* Logo */}
      <div className="px-4 py-5 flex items-center justify-between border-b border-white/10">
        {!collapsed ? (
          <div>
            <div className="text-white font-black text-base tracking-wider">BANGUNPRO</div>
            <div className="text-slate-500 text-[9px] tracking-widest uppercase font-medium">Management Construction</div>
          </div>
        ) : (
          <div className="text-primary font-black text-xl mx-auto">B</div>
        )}
        {/* Mobile close button */}
        {mobileOpen && (
          <button onClick={() => setMobileOpen(false)} className="text-white/60 hover:text-white p-1 rounded-lg lg:hidden">
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Project Type Switcher */}
      {!collapsed && (
        <div className="px-3 py-3 border-b border-white/10">
          <div className="flex bg-white/8 rounded-xl p-0.5 gap-0.5" style={{ background: 'rgba(255,255,255,0.06)' }}>
            {[{ id: 'gedung', emoji: '🏗️', label: 'Gedung' }, { id: 'jalan', emoji: '🛣️', label: 'Jalan' }].map(t => (
              <button key={t.id} onClick={() => setProjectType(t.id)}
                className={`flex-1 text-xs py-2 rounded-lg font-semibold transition-all ${projectType === t.id ? 'bg-white text-[#1A1A2E] shadow-sm' : 'text-slate-400 hover:text-slate-300'}`}>
                {t.emoji} {t.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto scrollbar-none px-2 py-3 space-y-3">
        {SECTIONS.map(section => (
          <div key={section.label}>
            {!collapsed && (
              <div className="text-slate-600 text-[9px] font-bold tracking-widest uppercase px-3 mb-1.5">{section.label}</div>
            )}
            {section.items.map(item => {
              const Icon = item.icon;
              const active = isActive(item.to);
              return (
                <Link key={item.to} to={item.to} onClick={handleNavClick}
                  className={`nav-item mb-0.5 ${active ? 'active' : ''}`}
                  title={collapsed ? item.label : undefined}>
                  <Icon className="w-4 h-4 flex-shrink-0" />
                  {!collapsed && <span className="flex-1 truncate">{item.label}</span>}
                  {!collapsed && active && <ChevronRight className="w-3 h-3 opacity-60" />}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Logout */}
      <div className="px-2 py-3 border-t border-white/10">
        <button onClick={logout}
          className="nav-item w-full !text-red-400 hover:!text-red-300"
          style={{ '--hover-bg': 'rgba(239,68,68,0.1)' }}>
          <LogOut className="w-4 h-4 flex-shrink-0" />
          {!collapsed && <span>Logout Sesi</span>}
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex flex-col fixed left-0 top-0 h-full z-30 transition-all duration-300"
        style={{ width: collapsed ? 64 : 220 }}>
        {sidebarContent}
      </aside>

      {/* Mobile drawer overlay */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-40 flex">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <aside className="relative w-64 flex flex-col h-full shadow-2xl" style={{ zIndex: 41 }}>
            {sidebarContent}
          </aside>
        </div>
      )}
    </>
  );
}
