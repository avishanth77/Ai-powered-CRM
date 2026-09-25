import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell,
  CheckCheck,
  Trash2,
  ExternalLink,
  UserCheck,
  Calendar,
  Clock,
  AlertCircle,
  MessageSquare,
  AtSign,
  Layers,
  Award,
  Search,
  Check
} from 'lucide-react';
import { notificationApi } from '../api/notificationApi';
import { useToast } from '../context/ToastContext';

export const Notifications = () => {
  const navigate = useNavigate();
  const { addToast } = useToast();

  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all'); // all, unread, leads, followups, mentions
  const [searchQuery, setSearchQuery] = useState('');

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const res = await notificationApi.getNotifications({ ordering: '-created_at' });
      const items = res.results || res;
      setNotifications(Array.isArray(items) ? items : []);
    } catch (err) {
      console.error('Error fetching notifications:', err);
      addToast('Failed to load notifications', 'error');
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const handleMarkRead = async (id) => {
    try {
      await notificationApi.markAsRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
      );
      addToast('Notification marked as read', 'success');
    } catch (err) {
      addToast('Failed to update notification', 'error');
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await notificationApi.markAllAsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      addToast('All notifications marked as read', 'success');
    } catch (err) {
      addToast('Failed to mark all as read', 'error');
    }
  };

  const handleDelete = async (id) => {
    try {
      await notificationApi.deleteNotification(id);
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      addToast('Notification deleted', 'info');
    } catch (err) {
      addToast('Failed to delete notification', 'error');
    }
  };

  const getNotificationIcon = (type) => {
    const t = (type || '').toLowerCase();
    switch (t) {
      case 'lead_assigned':
      case 'lead_handed_over':
        return <UserCheck size={18} />;
      case 'lead_stage_changed':
        return <Layers size={18} />;
      case 'follow_up_due':
      case 'follow_up_due_soon':
      case 'follow_up_created':
      case 'follow_up_assigned':
      case 'followup_due':
      case 'followup_created':
        return <Calendar size={18} />;
      case 'follow_up_overdue':
      case 'followup_overdue':
        return <AlertCircle size={18} />;
      case 'follow_up_completed':
      case 'followup_completed':
        return <Clock size={18} />;
      case 'internal_mention':
      case 'mention':
        return <AtSign size={18} />;
      case 'internal_comment':
      case 'comment':
        return <MessageSquare size={18} />;
      case 'customer_converted':
        return <Award size={18} />;
      default:
        return <Bell size={18} />;
    }
  };

  const getIconClass = (type) => {
    const t = (type || '').toLowerCase();
    if (t.startsWith('lead_')) return 'lead';
    if (t.startsWith('follow_up') || t.startsWith('followup')) return 'followup';
    if (t.includes('mention')) return 'mention';
    if (t.includes('comment')) return 'comment';
    if (t.includes('customer')) return 'customer';
    return 'stage';
  };

  const filteredNotifications = notifications.filter((notif) => {
    const notifType = (notif.notification_type || '').toLowerCase();

    // Tab filter
    if (activeTab === 'unread' && notif.is_read) return false;
    if (activeTab === 'leads' && !notifType.startsWith('lead_')) return false;
    if (activeTab === 'followups' && !notifType.startsWith('follow_up') && !notifType.startsWith('followup')) return false;
    if (activeTab === 'mentions' && !notifType.includes('mention') && !notifType.includes('comment')) return false;

    // Search filter
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchTitle = notif.title?.toLowerCase().includes(q);
      const matchMsg = notif.message?.toLowerCase().includes(q);
      if (!matchTitle && !matchMsg) return false;
    }

    return true;
  });

  const unreadTotal = notifications.filter((n) => !n.is_read).length;

  return (
    <div className="notifications-page-container">
      <div className="notifications-page-header">
        <div className="notifications-page-title-group">
          <h1>Notification Center</h1>
          <p className="notifications-page-subtitle">
            Stay updated with lead assignments, follow-ups, mentions, and system alerts
          </p>
        </div>

        {unreadTotal > 0 && (
          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleMarkAllRead}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <CheckCheck size={16} />
            <span>Mark All as Read ({unreadTotal})</span>
          </button>
        )}
      </div>

      {/* Filter Tabs & Search */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
        <div className="notifications-filter-bar" style={{ margin: 0 }}>
          <button
            type="button"
            className={`notifications-filter-tab ${activeTab === 'all' ? 'active' : ''}`}
            onClick={() => setActiveTab('all')}
          >
            All ({notifications.length})
          </button>
          <button
            type="button"
            className={`notifications-filter-tab ${activeTab === 'unread' ? 'active' : ''}`}
            onClick={() => setActiveTab('unread')}
          >
            Unread ({unreadTotal})
          </button>
          <button
            type="button"
            className={`notifications-filter-tab ${activeTab === 'leads' ? 'active' : ''}`}
            onClick={() => setActiveTab('leads')}
          >
            Leads
          </button>
          <button
            type="button"
            className={`notifications-filter-tab ${activeTab === 'followups' ? 'active' : ''}`}
            onClick={() => setActiveTab('followups')}
          >
            Follow-ups
          </button>
          <button
            type="button"
            className={`notifications-filter-tab ${activeTab === 'mentions' ? 'active' : ''}`}
            onClick={() => setActiveTab('mentions')}
          >
            Mentions & Comments
          </button>
        </div>

        <div style={{ position: 'relative', minWidth: '220px' }}>
          <input
            type="text"
            className="form-input"
            placeholder="Search notifications..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ paddingLeft: '32px', fontSize: '0.85rem' }}
          />
          <Search size={15} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)' }} />
        </div>
      </div>

      {/* Notifications List */}
      <div className="notifications-list-card">
        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-dim)' }}>
            Loading notification records...
          </div>
        ) : filteredNotifications.length === 0 ? (
          <div className="notification-empty" style={{ padding: '60px 20px' }}>
            <div className="notification-empty-icon">
              <Bell size={36} />
            </div>
            <h3 style={{ margin: '8px 0', color: 'var(--text-main)' }}>No notifications found</h3>
            <p>You're all caught up! No notifications match the selected filter.</p>
          </div>
        ) : (
          filteredNotifications.map((notif) => (
            <div
              key={notif.id}
              className={`notifications-page-item ${notif.is_read ? 'read' : 'unread'}`}
            >
              <div className={`notification-icon-box ${getIconClass(notif.notification_type)}`}>
                {getNotificationIcon(notif.notification_type)}
              </div>

              <div className="notification-content">
                <div className="notification-title" style={{ fontSize: '0.92rem' }}>
                  <span>{notif.title}</span>
                  <span className="notification-time">
                    {new Date(notif.created_at).toLocaleString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </span>
                </div>
                <div className="notification-message" style={{ WebkitLineClamp: 'unset', fontSize: '0.85rem', marginBottom: '8px' }}>
                  {notif.message}
                </div>

                <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                  {notif.actor_details && (
                    <span style={{ fontSize: '0.74rem', color: 'var(--text-dim)' }}>
                      By: {notif.actor_details.full_name || notif.actor_details.email}
                    </span>
                  )}
                  {notif.notification_type_display && (
                    <span style={{ fontSize: '0.72rem', background: 'var(--bg-surface-elevated)', padding: '2px 8px', borderRadius: '4px', border: '1px solid var(--border-subtle)', color: 'var(--text-muted)' }}>
                      {notif.notification_type_display}
                    </span>
                  )}
                </div>
              </div>

              <div className="notification-actions">
                {!notif.is_read && (
                  <button
                    type="button"
                    className="notification-action-btn"
                    onClick={() => handleMarkRead(notif.id)}
                    title="Mark as read"
                  >
                    <Check size={14} />
                    <span>Read</span>
                  </button>
                )}

                {notif.action_url && (
                  <button
                    type="button"
                    className="notification-action-btn"
                    onClick={() => {
                      if (!notif.is_read) handleMarkRead(notif.id);
                      navigate(notif.action_url);
                    }}
                    title="Open details"
                  >
                    <ExternalLink size={14} />
                    <span>View</span>
                  </button>
                )}

                <button
                  type="button"
                  className="notification-action-btn delete"
                  onClick={() => handleDelete(notif.id)}
                  title="Delete notification"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
