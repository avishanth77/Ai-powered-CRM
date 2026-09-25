import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Bell,
  UserCheck,
  Calendar,
  Clock,
  AlertCircle,
  MessageSquare,
  AtSign,
  Layers,
  Award,
  ExternalLink
} from 'lucide-react';

export const NotificationDropdown = ({
  notifications,
  unreadCount,
  loading,
  onClose,
  onMarkRead,
  onMarkAllRead
}) => {
  const navigate = useNavigate();

  const getNotificationIcon = (type) => {
    const t = (type || '').toLowerCase();
    switch (t) {
      case 'lead_assigned':
      case 'lead_handed_over':
        return <UserCheck size={16} />;
      case 'lead_stage_changed':
        return <Layers size={16} />;
      case 'follow_up_due':
      case 'follow_up_due_soon':
      case 'follow_up_created':
      case 'follow_up_assigned':
      case 'followup_due':
      case 'followup_created':
        return <Calendar size={16} />;
      case 'follow_up_overdue':
      case 'followup_overdue':
        return <AlertCircle size={16} />;
      case 'follow_up_completed':
      case 'followup_completed':
        return <Clock size={16} />;
      case 'internal_mention':
      case 'mention':
        return <AtSign size={16} />;
      case 'internal_comment':
      case 'comment':
        return <MessageSquare size={16} />;
      case 'customer_converted':
        return <Award size={16} />;
      default:
        return <Bell size={16} />;
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

  const formatRelativeTime = (isoString) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    const now = new Date();
    const diffSecs = Math.floor((now - date) / 1000);

    if (diffSecs < 60) return 'Just now';
    const diffMins = Math.floor(diffSecs / 60);
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

  const handleItemClick = async (notif) => {
    if (!notif.is_read) {
      await onMarkRead(notif.id);
    }
    onClose();
    if (notif.action_url) {
      navigate(notif.action_url);
    }
  };

  return (
    <>
      <div className="dropdown-overlay" onClick={onClose} />
      <div className="notification-dropdown" role="menu" aria-label="Notifications">
        <div className="notification-dropdown-header">
          <div className="notification-header-title">
            <span>Notifications</span>
            {unreadCount > 0 && (
              <span className="notification-header-badge">{unreadCount} new</span>
            )}
          </div>
          {unreadCount > 0 && (
            <button
              type="button"
              className="notification-mark-all-btn"
              onClick={onMarkAllRead}
              title="Mark all as read"
            >
              Mark all read
            </button>
          )}
        </div>

        <div className="notification-dropdown-list">
          {loading ? (
            <div className="notification-empty">Loading notifications...</div>
          ) : !notifications || notifications.length === 0 ? (
            <div className="notification-empty">
              <div className="notification-empty-icon">
                <Bell size={28} />
              </div>
              <p>No notifications yet</p>
            </div>
          ) : (
            notifications.map((notif) => (
              <div
                key={notif.id}
                className={`notification-item ${notif.is_read ? 'read' : 'unread'}`}
                role="button"
                tabIndex={0}
                aria-label={`${notif.title}${notif.is_read ? '' : ' (unread)'}`}
                onClick={() => handleItemClick(notif)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleItemClick(notif);
                  }
                }}
              >
                <div className={`notification-icon-box ${getIconClass(notif.notification_type)}`}>
                  {getNotificationIcon(notif.notification_type)}
                </div>
                <div className="notification-content">
                  <div className="notification-title">
                    <span>{notif.title}</span>
                    <time className="notification-time" dateTime={notif.created_at}>
                      {formatRelativeTime(notif.created_at)}
                    </time>
                  </div>
                  <div className="notification-message">{notif.message}</div>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="notification-dropdown-footer">
          <Link
            to="/notifications"
            className="notification-view-all-link"
            onClick={onClose}
          >
            <span>View All Notifications</span>
            <ExternalLink size={13} />
          </Link>
        </div>
      </div>
    </>
  );
};
