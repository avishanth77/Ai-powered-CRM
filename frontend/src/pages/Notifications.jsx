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
import { LoadingSpinner } from '../components/LoadingSpinner';
import { EmptyState } from '../components/EmptyState';
import { Pagination } from '../components/Pagination';

export const Notifications = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [activeTab, setActiveTab] = useState('all'); // all, unread, leads, followups, mentions
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [unreadTotal, setUnreadTotal] = useState(0);
  const pageSize = 20;

  // Debounce the search box so typing does not fire a request per keystroke
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchQuery(searchInput.trim());
      setCurrentPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const params = { page: currentPage, page_size: pageSize, ordering: '-created_at' };
      if (activeTab === 'unread') params.is_read = false;
      if (['leads', 'followups', 'mentions'].includes(activeTab)) params.group = activeTab;
      if (searchQuery) params.search = searchQuery;

      const [res, unreadRes] = await Promise.all([
        notificationApi.getNotifications(params),
        notificationApi.getUnreadCount(),
      ]);
      const items = res.results || (Array.isArray(res) ? res : []);
      if (items.length === 0 && currentPage > 1) {
        // Page emptied by a delete/mark-read — step back instead of showing empty
        setCurrentPage(currentPage - 1);
        return;
      }
      setNotifications(Array.isArray(items) ? items : []);
      setTotalCount(res.count ?? (Array.isArray(res) ? res.length : 0));
      setUnreadTotal(unreadRes.count ?? 0);
    } catch (err) {
      console.error('Error fetching notifications:', err);
      setLoadError('Failed to load notifications');
      showToast('Failed to load notifications', 'error');
    } finally {
      setLoading(false);
    }
  }, [activeTab, searchQuery, currentPage, showToast]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const handleMarkRead = async (id) => {
    try {
      await notificationApi.markAsRead(id);
      showToast('Notification marked as read', 'success');
      fetchNotifications();
    } catch (err) {
      showToast('Failed to update notification', 'error');
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await notificationApi.markAllAsRead();
      showToast('All notifications marked as read', 'success');
      fetchNotifications();
    } catch (err) {
      showToast('Failed to mark all as read', 'error');
    }
  };

  const handleDelete = async (id) => {
    try {
      await notificationApi.deleteNotification(id);
      showToast('Notification deleted', 'info');
      fetchNotifications();
    } catch (err) {
      showToast('Failed to delete notification', 'error');
    }
  };

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setCurrentPage(1);
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
        <div className="notifications-filter-bar" style={{ margin: 0 }} role="tablist" aria-label="Notification filters">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'all'}
            className={`notifications-filter-tab ${activeTab === 'all' ? 'active' : ''}`}
            onClick={() => handleTabChange('all')}
          >
            All ({totalCount})
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'unread'}
            className={`notifications-filter-tab ${activeTab === 'unread' ? 'active' : ''}`}
            onClick={() => handleTabChange('unread')}
          >
            Unread ({unreadTotal})
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'leads'}
            className={`notifications-filter-tab ${activeTab === 'leads' ? 'active' : ''}`}
            onClick={() => handleTabChange('leads')}
          >
            Leads
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'followups'}
            className={`notifications-filter-tab ${activeTab === 'followups' ? 'active' : ''}`}
            onClick={() => handleTabChange('followups')}
          >
            Follow-ups
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'mentions'}
            className={`notifications-filter-tab ${activeTab === 'mentions' ? 'active' : ''}`}
            onClick={() => handleTabChange('mentions')}
          >
            Mentions & Comments
          </button>
        </div>

        <div style={{ position: 'relative', minWidth: '220px' }} role="search">
          <input
            type="search"
            className="form-input"
            placeholder="Search notifications..."
            aria-label="Search notifications"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            style={{ paddingLeft: '32px', fontSize: '0.85rem' }}
          />
          <Search size={15} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)' }} />
        </div>
      </div>

      {/* Notifications List */}
      <div className="notifications-list-card">
        {loading ? (
          <LoadingSpinner text="Loading notifications..." />
        ) : loadError ? (
          <EmptyState
            title="Could not load notifications"
            message={loadError}
            actionLabel="Retry"
            onAction={() => fetchNotifications()}
          />
        ) : notifications.length === 0 ? (
          <div className="notification-empty" style={{ padding: '60px 20px' }}>
            <div className="notification-empty-icon">
              <Bell size={36} />
            </div>
            <h3 style={{ margin: '8px 0', color: 'var(--text-main)' }}>No notifications found</h3>
            <p>You're all caught up! No notifications match the selected filter.</p>
          </div>
        ) : (
          notifications.map((notif) => (
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
                    aria-label={`Mark as read: ${notif.title}`}
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
                  aria-label={`Delete notification: ${notif.title}`}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {!loading && !loadError && notifications.length > 0 && (
        <Pagination
          currentPage={currentPage}
          totalCount={totalCount}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
        />
      )}
    </div>
  );
};
