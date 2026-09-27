import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Bell } from 'lucide-react';
import { notificationApi } from '../api/notificationApi';
import { NotificationDropdown } from './NotificationDropdown';

export const NotificationBell = () => {
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const intervalRef = useRef(null);
  const notificationContainerRef = useRef(null);

  const fetchUnreadCount = useCallback(async () => {
    try {
      const data = await notificationApi.getUnreadCount();
      setUnreadCount(typeof data.count === 'number' ? data.count : 0);
    } catch (err) {
      // Silently fail without breaking the UI if unauthenticated or network error
      console.warn('Failed to fetch notification count:', err);
    }
  }, []);

  const fetchRecentNotifications = async () => {
    setLoading(true);
    try {
      const res = await notificationApi.getNotifications({ ordering: '-created_at' });
      const items = res.results || res;
      setNotifications(Array.isArray(items) ? items.slice(0, 10) : []);
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUnreadCount();
    // Poll every 30 seconds for background updates
    intervalRef.current = setInterval(fetchUnreadCount, 30000);
    // Refresh the badge when the tab regains focus
    const onFocus = () => fetchUnreadCount();
    window.addEventListener('focus', onFocus);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      window.removeEventListener('focus', onFocus);
    };
  }, [fetchUnreadCount]);

  // Close the dropdown on Escape or click outside
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e) => {
      if (
        notificationContainerRef.current &&
        !notificationContainerRef.current.contains(e.target)
      ) {
        setIsOpen(false);
      }
    };

    const onKey = (e) => {
      if (e.key === 'Escape') setIsOpen(false);
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    document.addEventListener('keydown', onKey);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
      document.removeEventListener('keydown', onKey);
    };
  }, [isOpen]);

  const toggleDropdown = async () => {
    if (!isOpen) {
      setIsOpen(true);
      await fetchRecentNotifications();
    } else {
      setIsOpen(false);
    }
  };

  const handleMarkRead = async (id) => {
    try {
      await notificationApi.markAsRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (err) {
      console.error('Failed to mark notification as read:', err);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await notificationApi.markAllAsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error('Failed to mark all notifications as read:', err);
    }
  };

  return (
    <div className="notification-bell-container" ref={notificationContainerRef}>
      <button
        type="button"
        className={`notification-bell-btn ${unreadCount > 0 ? 'has-unread' : ''}`}
        onClick={toggleDropdown}
        aria-label="View notifications"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        title={unreadCount > 0 ? `${unreadCount} unread notification(s)` : 'Notifications'}
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span className="notification-badge">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <NotificationDropdown
          notifications={notifications}
          unreadCount={unreadCount}
          loading={loading}
          onClose={() => setIsOpen(false)}
          onMarkRead={handleMarkRead}
          onMarkAllRead={handleMarkAllRead}
        />
      )}
    </div>
  );
};
