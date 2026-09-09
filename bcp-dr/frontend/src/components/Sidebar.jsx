import { Link, NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  IconBox,
  IconCart,
  IconEdit,
  IconHome,
  IconLayers,
  IconLogout,
  IconPlus,
  IconBell
} from './Icons';

function linkIsActive(to, pathname, end) {
  if (to === '/products') {
    return pathname === '/products' || (pathname.startsWith('/products/') && pathname !== '/products/manage');
  }
  if (end) {
    return pathname === to;
  }
  return pathname === to || pathname.startsWith(`${to}/`);
}

export default function Sidebar({ open, onClose, unreadCount = 0 }) {
  const { isAdmin, isCustomer, logout } = useAuth();
  const { pathname } = useLocation();
  const unread = Number(unreadCount) || 0;
  const badgeLabel = unread > 99 ? '99+' : String(unread);

  const links = [
    { to: '/', label: 'Home', end: true, icon: <IconHome /> },
    { to: '/products', label: 'Products', icon: <IconBox /> },
    ...(isAdmin ? [
      { to: '/products/manage', label: 'Manage Products', icon: <IconEdit /> },
      { to: '/inventory', label: 'Inventory', icon: <IconLayers /> }
    ] : []),
    { to: '/orders', label: 'Orders', icon: <IconCart /> },
    ...(isCustomer ? [
      { to: '/orders/create', label: 'Create Order', icon: <IconPlus /> }
    ] : []),
    { to: '/notifications', label: 'Notifications', icon: <IconBell /> }
  ];

  return (
    <>
      {open && <button type="button" className="sidebar-backdrop" aria-label="Close menu" onClick={onClose} />}
      <aside className={`sidebar ${open ? 'is-open' : ''}`}>
        <Link className="sidebar-brand" to="/" onClick={onClose}>
          <span className="sidebar-mark">E</span>
          <span>E-commerce</span>
        </Link>

        <nav className="sidebar-nav">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.end}
              className={() => `sidebar-link${linkIsActive(link.to, pathname, link.end) ? ' is-active' : ''}`}
              onClick={onClose}
            >
              {link.icon}
              <span>{link.label}</span>
              {link.to === '/notifications' && unread > 0 && (
                <span className="sidebar-badge">{badgeLabel}</span>
              )}
            </NavLink>
          ))}
        </nav>

        <button className="sidebar-logout" type="button" onClick={logout}>
          <IconLogout />
          <span>Logout</span>
        </button>
      </aside>
    </>
  );
}
