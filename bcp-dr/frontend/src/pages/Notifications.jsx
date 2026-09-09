import { useEffect, useState } from 'react';
import AlertMessage from '../components/AlertMessage';
import EmptyState from '../components/EmptyState';
import LoadingState from '../components/LoadingState';
import StatusBadge from '../components/StatusBadge';
import { useAuth } from '../context/AuthContext';
import { emitNotificationsChanged } from '../hooks/useUnreadCount';
import { notificationApi } from '../services/api';

function isUnread(notification) {
  return String(notification.status || '').toUpperCase() === 'UNREAD';
}

export default function Notifications() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState(null);
  const [markingAll, setMarkingAll] = useState(false);

  const unreadCount = notifications.filter(isUnread).length;

  const loadNotifications = () => notificationApi.listForUser(user.id).then(setNotifications);

  useEffect(() => {
    if (!user) {
      return;
    }
    loadNotifications()
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [user]);

  const handleMarkAsRead = async (id) => {
    setError('');
    setSuccess('');
    setUpdatingId(id);
    try {
      await notificationApi.markAsRead(id);
      setNotifications((current) => current.map((item) => (
        item.id === id ? { ...item, status: 'READ' } : item
      )));
      emitNotificationsChanged();
    } catch (err) {
      setError(err.message);
    } finally {
      setUpdatingId(null);
    }
  };

  const handleMarkAllAsRead = async () => {
    setError('');
    setSuccess('');
    setMarkingAll(true);
    try {
      const updated = await notificationApi.markAllAsRead(user.id);
      setNotifications(updated);
      setSuccess('All notifications marked as read.');
      emitNotificationsChanged();
    } catch (err) {
      setError(err.message);
    } finally {
      setMarkingAll(false);
    }
  };

  return (
    <div className="page-card p-4">
      <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
        <div>
          <p className="page-kicker">Account</p>
          <h1 className="h3 page-title mb-1">Notifications</h1>
          <p className="text-muted mb-0">
            {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
          </p>
        </div>
        <button
          className="btn btn-theme"
          disabled={markingAll || unreadCount === 0}
          onClick={handleMarkAllAsRead}
        >
          {markingAll ? 'Updating...' : 'Mark all as read'}
        </button>
      </div>
      <AlertMessage error={error} success={success} />
      {loading && <LoadingState message="Loading notifications..." />}
      {!loading && notifications.length === 0 && !error && (
        <EmptyState title="No notifications yet" message="Order created and cancelled events for your account appear here." />
      )}
      <div className="list-group app-list">
        {notifications.map((item) => {
          const unread = isUnread(item);
          return (
            <div className={`list-group-item ${unread ? 'list-group-item-unread' : ''}`} key={item.id}>
              <div className="d-flex justify-content-between align-items-start gap-3">
                <div>
                  <div className="d-flex align-items-center gap-2 mb-1">
                    <strong>{item.type}</strong>
                    <StatusBadge value={unread ? 'UNREAD' : 'READ'} />
                  </div>
                  <div>{item.message}</div>
                  <div className="small text-muted mt-1">{new Date(item.createdAt).toLocaleString()}</div>
                </div>
                {unread && (
                  <button
                    className="btn btn-theme btn-sm flex-shrink-0"
                    disabled={updatingId === item.id}
                    onClick={() => handleMarkAsRead(item.id)}
                  >
                    {updatingId === item.id ? 'Saving...' : 'Mark as read'}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
