import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import AlertMessage from '../components/AlertMessage';
import LoadingState from '../components/LoadingState';
import { useAuth } from '../context/AuthContext';
import { notificationApi, orderApi, productApi } from '../services/api';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const AVATAR_COLORS = ['#db4444', '#111827', '#6b7280', '#c73838'];

function money(value) {
  return `₹${Number(value || 0).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function initials(text = '') {
  return String(text).split(' ').filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'P';
}

function monthKey(date) {
  return `${date.getFullYear()}-${date.getMonth()}`;
}

export default function Dashboard() {
  const { user, isAdmin } = useAuth();
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const requests = [productApi.list(), orderApi.list()];
    if (user?.id) {
      requests.push(notificationApi.listForUser(user.id).catch(() => []));
    }

    Promise.all(requests)
      .then(([nextProducts, nextOrders, nextNotifications]) => {
        setProducts(nextProducts);
        setOrders(nextOrders);
        setNotifications(nextNotifications || []);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [user?.id]);

  const confirmedOrders = orders.filter((order) => order.status === 'CONFIRMED');
  const income = confirmedOrders.reduce((sum, order) => sum + Number(order.totalAmount || 0), 0);
  const unread = notifications.filter((item) => String(item.status).toUpperCase() === 'UNREAD').length;

  const chart = useMemo(() => {
    const now = new Date();
    const buckets = Array.from({ length: 12 }, (_, index) => {
      const date = new Date(now.getFullYear(), now.getMonth() - (11 - index), 1);
      return { key: monthKey(date), label: MONTHS[date.getMonth()], total: 0 };
    });
    const indexByKey = Object.fromEntries(buckets.map((bucket, index) => [bucket.key, index]));
    orders.forEach((order) => {
      if (!order.createdAt) {
        return;
      }
      const key = monthKey(new Date(order.createdAt));
      if (indexByKey[key] !== undefined) {
        buckets[indexByKey[key]].total += Number(order.totalAmount || 0);
      }
    });
    const max = Math.max(...buckets.map((bucket) => bucket.total), 1);
    return { buckets, max };
  }, [orders]);

  const popular = useMemo(() => {
    const counts = {};
    orders.forEach((order) => {
      order.items?.forEach((item) => {
        counts[item.productId] = (counts[item.productId] || 0) + Number(item.quantity || 0);
      });
    });
    return [...products]
      .sort((left, right) => (counts[right.id] || 0) - (counts[left.id] || 0))
      .slice(0, 4)
      .map((product) => ({ ...product, sold: counts[product.id] || 0 }));
  }, [products, orders]);

  const recentNotes = notifications.slice(0, 4);

  if (loading) {
    return <LoadingState message="Loading dashboard..." />;
  }

  return (
    <div className="dash-page">
      <h1 className="dash-title">Dashboard</h1>
      <AlertMessage error={error} />

      <div className="dash-grid">
        <section className="widget">
          <div className="widget-head">
            <h2>Overview</h2>
            <span className="widget-filter">All time</span>
          </div>
          <div className="stat-row">
            <article className="stat-card">
              <p>{isAdmin ? 'Orders' : 'My orders'}</p>
              <strong>{orders.length.toLocaleString('en-IN')}</strong>
            </article>
            <article className="stat-card">
              <p>{isAdmin ? 'Income' : 'Order value'}</p>
              <strong>{money(income)}</strong>
            </article>
          </div>
          <div className="welcome-row">
            <div>
              <p className="welcome-copy">Welcome back, {user?.name}. Browse the catalog and keep orders moving.</p>
              <div className="avatar-row">
                {products.slice(0, 4).map((product, index) => (
                  <div key={product.id} className="mini-person">
                    <span className="mini-avatar" style={{ background: AVATAR_COLORS[index % AVATAR_COLORS.length] }}>
                      {initials(product.name)}
                    </span>
                    <span>{product.name.split(' ')[0]}</span>
                  </div>
                ))}
                {products.length === 0 && <span className="text-muted">No catalog items yet.</span>}
              </div>
            </div>
          </div>
        </section>

        <section className="widget">
          <div className="widget-head">
            <h2>Popular products</h2>
          </div>
          <div className="product-list">
            <div className="product-list-head">
              <span>Product</span>
              <span>Price</span>
            </div>
            {popular.length === 0 && <p className="text-muted mb-0">No products yet.</p>}
            {popular.map((product, index) => (
              <Link className="product-list-row" key={product.id} to={`/products/${product.id}`}>
                <span className="mini-avatar" style={{ background: AVATAR_COLORS[index % AVATAR_COLORS.length] }}>
                  {initials(product.name)}
                </span>
                <span className="product-list-name">{product.name}</span>
                <span className="product-price">{money(product.price)}</span>
              </Link>
            ))}
          </div>
          <Link className="widget-footer-btn" to="/products">All products</Link>
        </section>

        <section className="widget">
          <div className="widget-head">
            <h2>{isAdmin ? 'Total income' : 'Order activity'}</h2>
            <span className="widget-filter">Last 12 months</span>
          </div>
          <div className="chart-bars" role="img" aria-label="Monthly order totals">
            {chart.buckets.map((bucket) => (
              <div className="chart-col" key={bucket.key}>
                <div className="chart-track">
                  <div className="chart-bar" style={{ height: `${Math.max((bucket.total / chart.max) * 100, bucket.total ? 8 : 2)}%` }} />
                </div>
                <span>{bucket.label}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="widget">
          <div className="widget-head">
            <h2>Notifications</h2>
            <span className="widget-filter">{unread} unread</span>
          </div>
          <div className="activity-list">
            <div className="activity-head">
              <span>Update</span>
              <span>Date</span>
            </div>
            {recentNotes.length === 0 && <p className="text-muted mb-0">No notifications yet.</p>}
            {recentNotes.map((item) => (
              <div className="activity-row" key={item.id}>
                <span>{item.message}</span>
                <span>{item.createdAt ? new Date(item.createdAt).toLocaleDateString() : '—'}</span>
              </div>
            ))}
          </div>
          <Link className="widget-footer-btn" to="/notifications">All notifications</Link>
        </section>
      </div>
    </div>
  );
}
