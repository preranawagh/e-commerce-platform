import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import StatusBadge from './StatusBadge';
import { IconBell, IconMenu, IconSearch } from './Icons';

function initials(name = '') {
  return name.split(' ').filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'U';
}

export default function Topbar({ onMenuClick, unreadCount = 0 }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [query, setQuery] = useState(params.get('q') || '');

  useEffect(() => {
    setQuery(params.get('q') || '');
  }, [params]);

  const handleSearch = (event) => {
    event.preventDefault();
    const next = query.trim();
    navigate(next ? `/products?q=${encodeURIComponent(next)}` : '/products');
  };

  const unread = Number(unreadCount) || 0;
  const badgeLabel = unread > 99 ? '99+' : String(unread);

  return (
    <header className="topbar">
      <button className="topbar-menu" type="button" onClick={onMenuClick} aria-label="Open menu">
        <IconMenu />
      </button>

      <form className="topbar-search" onSubmit={handleSearch}>
        <IconSearch />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search products or type a command"
          aria-label="Search products"
        />
      </form>

      <div className="topbar-actions">
        <Link
          className="topbar-notify"
          to="/notifications"
          aria-label={unread > 0 ? `${unread} unread notifications` : 'Notifications'}
        >
          <span className="topbar-icon">
            <IconBell />
          </span>
          {unread > 0 && <span className="topbar-badge">{badgeLabel}</span>}
        </Link>
        <div className="topbar-user">
          <div className="topbar-avatar">{initials(user?.name)}</div>
          <div className="d-none d-md-block">
            <div className="app-nav-user">{user?.name}</div>
            <StatusBadge value={user?.role} />
          </div>
        </div>
      </div>
    </header>
  );
}
