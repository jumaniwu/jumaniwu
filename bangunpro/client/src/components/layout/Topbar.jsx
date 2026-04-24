import { Menu, Bell, ChevronRight } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useProject } from '../../context/ProjectContext';

export default function Topbar({ collapsed, setCollapsed, setMobileOpen, title }) {
  const { user, tenant } = useAuth();
  const { activeProject } = useProject();
  const isDemo = user?.is_demo === 1 || tenant?.plan === 'trial';

  return (
    <header className="bg-white border-b border-gray-100 h-14 flex items-center px-4 gap-3 sticky top-0 z-20 shadow-sm">
      {/* Desktop collapse toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="hidden lg:flex p-2 hover:bg-gray-100 rounded-xl transition-all"
        aria-label="Toggle sidebar">
        <Menu className="w-5 h-5 text-gray-500" />
      </button>

      {/* Mobile menu toggle */}
      <button
        onClick={() => setMobileOpen(true)}
        className="lg:hidden p-2 hover:bg-gray-100 rounded-xl transition-all"
        aria-label="Open menu">
        <Menu className="w-5 h-5 text-gray-500" />
      </button>

      {/* Title */}
      <div className="flex-1 min-w-0">
        <h1 className="font-bold text-[#1A1A2E] text-sm sm:text-base truncate">{title}</h1>
        {activeProject && (
          <div className="flex items-center gap-1 lg:hidden">
            <span className="text-[10px] text-gray-400 truncate">{activeProject.name}</span>
          </div>
        )}
      </div>

      {/* Right side */}
      <div className="flex items-center gap-2">
        {isDemo && (
          <span className="hidden sm:inline-flex items-center bg-amber-50 text-amber-700 text-xs font-bold px-2.5 py-1 rounded-lg border border-amber-200">
            DEMO 🏷️
          </span>
        )}
        <button className="relative p-2 hover:bg-gray-100 rounded-xl transition-all" aria-label="Notifications">
          <Bell className="w-4 h-4 text-gray-500" />
          <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-primary rounded-full" />
        </button>
        {activeProject && (
          <div className="hidden lg:flex flex-col items-end">
            <span className="text-[9px] text-gray-400 uppercase tracking-widest font-semibold">Active Project</span>
            <span className="text-xs font-bold text-[#1A1A2E] max-w-36 truncate">{activeProject.name}</span>
          </div>
        )}
      </div>
    </header>
  );
}
