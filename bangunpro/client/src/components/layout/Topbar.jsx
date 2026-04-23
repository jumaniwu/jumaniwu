import { Menu, Bell } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useProject } from '../../context/ProjectContext';

export default function Topbar({ collapsed, setCollapsed, title }) {
  const { user, tenant } = useAuth();
  const { activeProject } = useProject();
  const isDemo = user?.is_demo === 1 || tenant?.plan === 'trial';

  return (
    <header className="bg-white border-b border-gray-200 shadow-sm h-14 flex items-center px-4 gap-4 sticky top-0 z-20">
      <button onClick={() => setCollapsed(!collapsed)} className="p-1.5 hover:bg-gray-100 rounded-lg transition-all">
        <Menu className="w-5 h-5 text-gray-600" />
      </button>

      <h1 className="font-bold text-navy text-base flex-1">{title}</h1>

      <div className="flex items-center gap-3">
        {isDemo && (
          <span className="bg-yellow-100 text-yellow-800 text-xs font-bold px-2.5 py-1 rounded-full border border-yellow-300">
            DEMO GUEST 🏷️
          </span>
        )}
        <button className="p-1.5 hover:bg-gray-100 rounded-lg relative">
          <Bell className="w-5 h-5 text-gray-600" />
        </button>
        {activeProject && (
          <div className="text-right hidden sm:block">
            <div className="text-[10px] text-gray-400 font-semibold uppercase tracking-wide">Active Project</div>
            <div className="text-xs font-bold text-navy truncate max-w-32">{activeProject.name}</div>
          </div>
        )}
      </div>
    </header>
  );
}
