import { useState } from 'react';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import PromoBanner from './PromoBanner';
import BottomNav from './BottomNav';
import { useAuth } from '../../context/AuthContext';

export default function Layout({ children, title = 'BangunPro' }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user, tenant } = useAuth();
  const isDemo = user?.is_demo === 1 || tenant?.plan === 'trial';
  const sidebarW = collapsed ? 64 : 220;

  return (
    <div className="min-h-screen" style={{ background: '#F4F6F9' }}>
      {/* Promo banner */}
      {isDemo && <PromoBanner />}

      {/* Sidebar */}
      <Sidebar
        collapsed={collapsed}
        setCollapsed={setCollapsed}
        mobileOpen={mobileOpen}
        setMobileOpen={setMobileOpen}
      />

      {/* Main content */}
      <div
        className="flex flex-col min-h-screen transition-all duration-300"
        style={{
          marginLeft: 0,
          paddingTop: isDemo ? 40 : 0,
        }}
      >
        {/* Desktop margin for sidebar */}
        <div className="hidden lg:block" style={{ marginLeft: sidebarW - 220 }} />

        <div className="lg:pl-0 transition-all duration-300" style={{ paddingLeft: 0 }}>
          {/* We use CSS to offset on desktop */}
        </div>

        <div className="flex flex-col min-h-screen transition-all duration-300"
          style={{ '--sidebar-w': `${sidebarW}px` }}>
          {/* Desktop sidebar offset */}
          <style>{`@media (min-width: 1024px) { .sidebar-offset { margin-left: ${sidebarW}px; } }`}</style>

          <div className="sidebar-offset flex flex-col min-h-screen">
            <Topbar
              collapsed={collapsed}
              setCollapsed={setCollapsed}
              setMobileOpen={setMobileOpen}
              title={title}
            />
            <main className="flex-1 p-4 sm:p-5 lg:p-6 pb-24 lg:pb-6">
              {children}
            </main>
          </div>
        </div>
      </div>

      {/* Mobile bottom nav */}
      <BottomNav />
    </div>
  );
}
