import { useState } from 'react';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import PromoBanner from './PromoBanner';
import { useAuth } from '../../context/AuthContext';

export default function Layout({ children, title = 'BangunPro' }) {
  const [collapsed, setCollapsed] = useState(false);
  const { user, tenant } = useAuth();
  const isDemo = user?.is_demo === 1 || tenant?.plan === 'trial';
  const sidebarW = collapsed ? 64 : 220;

  return (
    <div className="min-h-screen bg-main-bg">
      {isDemo && <PromoBanner />}
      <Sidebar collapsed={collapsed} setCollapsed={setCollapsed} />
      <div
        className="flex flex-col min-h-screen transition-all duration-300"
        style={{ marginLeft: sidebarW, paddingTop: isDemo ? 44 : 0 }}
      >
        <Topbar collapsed={collapsed} setCollapsed={setCollapsed} title={title} />
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
