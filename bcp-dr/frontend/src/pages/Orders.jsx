import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import AlertMessage from '../components/AlertMessage';
import EmptyState from '../components/EmptyState';
import LoadingState from '../components/LoadingState';
import StatusBadge from '../components/StatusBadge';
import { useAuth } from '../context/AuthContext';
import { orderApi } from '../services/api';

export default function Orders() {
  const { user, isAdmin, isCustomer } = useAuth();
  const [orders, setOrders] = useState([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(true);
  const [cancellingId, setCancellingId] = useState(null);

  const loadOrders = () => orderApi.list().then(setOrders);

  useEffect(() => {
    loadOrders()
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const handleCancel = async (id) => {
    if (!window.confirm(`Cancel order #${id}? Reserved stock will be released.`)) {
      return;
    }
    setError('');
    setSuccess('');
    setCancellingId(id);
    try {
      await orderApi.cancel(id);
      setSuccess(`Order #${id} cancelled. Reserved stock was released.`);
      await loadOrders();
    } catch (err) {
      setError(err.message);
    } finally {
      setCancellingId(null);
    }
  };

  return (
    <div className="page-card p-4">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <div>
          <p className="page-kicker">{isAdmin ? 'Admin' : 'Account'}</p>
          <h1 className="h3 page-title mb-1">{isAdmin ? 'All Orders' : 'My Orders'}</h1>
          <p className="text-muted mb-0">
            {isAdmin ? 'Administrators can view and cancel every customer order.' : 'You can only see and cancel your own orders.'}
          </p>
        </div>
        {isCustomer && <Link className="btn btn-theme btn-sm" to="/orders/create">Create order</Link>}
      </div>
      <AlertMessage error={error} success={success} />
      {loading && <LoadingState message="Loading orders..." />}
      {!loading && orders.length === 0 && (
        <EmptyState title="No orders" message={isCustomer ? 'Place an order to see it here.' : 'No orders have been placed yet.'} />
      )}
      {!loading && orders.length > 0 && (
        <div className="table-responsive">
          <table className="table align-middle app-table">
            <thead>
              <tr>
                <th>Order ID</th>
                {isAdmin && <th>Customer ID</th>}
                <th>Status</th>
                <th>Total</th>
                <th>Items</th>
                <th>Created At</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id}>
                  <td>#{order.id}</td>
                  {isAdmin && <td>{order.userId}</td>}
                  <td><StatusBadge value={order.status} /></td>
                  <td>₹{Number(order.totalAmount).toFixed(2)}</td>
                  <td>{order.items?.map((item) => `${item.quantity} × product ${item.productId}`).join(', ')}</td>
                  <td>{order.createdAt ? new Date(order.createdAt).toLocaleString() : '—'}</td>
                  <td className="text-end">
                    {order.status !== 'CANCELLED' && (isAdmin || order.userId === user?.id) && (
                      <button
                        className="btn btn-sm btn-outline-danger"
                        disabled={cancellingId === order.id}
                        onClick={() => handleCancel(order.id)}
                      >
                        {cancellingId === order.id ? 'Cancelling...' : 'Cancel'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
