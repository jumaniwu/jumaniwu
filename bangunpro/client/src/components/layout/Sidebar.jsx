import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, FolderOpen, FileText, Receipt, Package, TrendingUp, DollarSign, RefreshCw, Database, FlaskConical, Wrench, Building2, Layers, Sun, Cog, ArrowUpRight, Home, LogOut, ChevronRight } from 'lucide-react';
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
  { label: 'PEKERJAAN KONSTRUKSI', items: [
    { icon: Wrench, label: 'Persiapan', to: '/pekerjaan/persiapan' },
    { icon: Building2, label: 'Pondasi', to: '/pekerjaan/pondasi' },
    { icon: Layers, label: 'Beton Struktur', to: '/pekerjaan/beton-struktur' },
    { icon: Sun, label: 'Kanopi', to: '/pekerjaan/kanopi' },
    { icon: Cog, label: 'Baja Struktural', to: '/pekerjaan/baja-struktural' },
    { icon: ArrowUpRight, label: 'Tangga', to: '/pekerjaan/tangga' },
    { icon: Home, label: 'Pek. Atap', to: '/pekerjaan/pek-atap' },
  ]},
];

export default function Sidebar({ collapsed, setCollapsed }) {
  const location = useLocation();
  const { logout } = useAuth();
  const { projectType, setProjectType } = useProject();

  const isActive = (to) => location.pathname === to || location.pathname.startsWith(to + '/');

  return (
    <aside
      className="fixed left-0 top-0 h-full z-30 flex flex-col transition-all duration-300"
      style={{ width: collapsed ? 64 : 220, background: '#16213E', minHeight: '100vh' }}
    >
      {/* Logo */}
      <div className="px-4 py-5 border-b border-white/10">
        {!collapsed ? (
          <>
            <div className="text-white font-black text-lg tracking-wide">BANGUNPRO</div>
            <div className="text-gray-400 text-[10px] tracking-widest uppercase mt-0.5">Management Construction</div>
          </>
        ) : (
          <div className="text-primary font-black text-xl text-center">B</div>
        )}
      </div>

      {/* Project Type Switcher */}
      {!collapsed && (
        <div className="px-3 py-3 border-b border-white/10">
          <div className="flex rounded-lg overflow-hidden bg-white/10 p-0.5">
            <button
              onClick={() => setProjectType('gedung')}
              className={`flex-1 text-xs py-1.5 rounded font-medium transition-all ${projectType === 'gedung' ? 'bg-white text-navy' : 'text-gray-400'}`}
            >
              🏗️ Gedung
            </button>
            <button
              onClick={() => setProjectType('jalan')}
              className={`flex-1 text-xs py-1.5 rounded font-medium transition-all ${projectType === 'jalan' ? 'bg-white text-navy' : 'text-gray-400'}`}
            >
              🛣️ Jalan
            </button>
          </div>
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-4">
        {SECTIONS.map(section => (
          <div key={section.label}>
            {!collapsed && (
              <div className="text-gray-500 text-[10px] font-bold tracking-widest uppercase px-2 mb-2">
                {section.label}
              </div>
            )}
            {section.items.map(item => {
              const Icon = item.icon;
              const active = isActive(item.to);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`sidebar-item mb-0.5 ${active ? 'active' : ''}`}
                  title={collapsed ? item.label : ''}
                >
                  <Icon className="w-4 h-4 flex-shrink-0" />
                  {!collapsed && <span className="truncate">{item.label}</span>}
                  {!collapsed && active && <ChevronRight className="w-3 h-3 ml-auto opacity-70" />}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Logout */}
      <div className="px-2 py-3 border-t border-white/10">
        <button
          onClick={logout}
          className="sidebar-item w-full text-red-400 hover:!text-red-300 hover:!bg-red-500/10"
        >
          <LogOut className="w-4 h-4 flex-shrink-0" />
          {!collapsed && <span>Logout Sesi</span>}
        </button>
      </div>
    </aside>
  );
}
