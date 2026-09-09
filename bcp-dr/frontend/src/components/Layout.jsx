import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useUnreadCount } from '../hooks/useUnreadCount';
import Sidebar from './Sidebar';
import Topbar from './Topbar';

export default function Layout({ children }) {
  const location = useLocation();
  const { isAuthenticated } = useAuth();
  const unreadCount = useUnreadCount();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const isAuthPage = location.pathname === '/login' || location.pathname === '/register';

  if (isAuthPage || !isAuthenticated) {
    return <main>{children}</main>;
  }

  return (
    <div className="app-shell">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} unreadCount={unreadCount} />
      <div className="app-content">
        <Topbar onMenuClick={() => setSidebarOpen(true)} unreadCount={unreadCount} />
        <main className="app-main">{children}</main>
      </div>
    </div>
  );
}
