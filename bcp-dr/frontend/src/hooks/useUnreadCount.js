import { useCallback, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { notificationApi } from '../services/api';

export function countUnread(items) {
  if (!Array.isArray(items)) {
    return 0;
  }
  return items.filter((item) => String(item.status || '').toUpperCase() === 'UNREAD').length;
}

export function emitNotificationsChanged() {
  window.dispatchEvent(new Event('notifications-changed'));
}

export function useUnreadCount() {
  const { user } = useAuth();
  const location = useLocation();
  const [unread, setUnread] = useState(0);
  const userId = user?.id ?? user?.userId;

  const loadUnread = useCallback(async () => {
    if (!userId) {
      setUnread(0);
      return;
    }
    try {
      const items = await notificationApi.listForUser(userId);
      setUnread(countUnread(items));
    } catch {
      setUnread(0);
    }
  }, [userId]);

  useEffect(() => {
    loadUnread();
    if (!userId) {
      return undefined;
    }
    const interval = window.setInterval(loadUnread, 5000);
    const refresh = () => loadUnread();
    window.addEventListener('focus', refresh);
    window.addEventListener('notifications-changed', refresh);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', refresh);
      window.removeEventListener('notifications-changed', refresh);
    };
  }, [loadUnread, location.pathname, userId]);

  return unread;
}
