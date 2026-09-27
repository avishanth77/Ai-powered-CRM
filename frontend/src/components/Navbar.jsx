import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { getInitials } from '../utils/formatters';
import { ROLE_LABELS } from '../utils/constants';
import { LogOut, User as UserIcon, Menu, Shield, Clock, Sun, Moon } from 'lucide-react';
import { Link } from 'react-router-dom';
import { NotificationBell } from './NotificationBell';

export const Navbar = ({ onToggleMobileSidebar, overdueCount = 0, mobileSidebarOpen = false }) => {
  const { user, logout } = useAuth();
  const { theme, isDark, toggleTheme } = useTheme();
  const [showDropdown, setShowDropdown] = useState(false);
  const profileMenuRef = useRef(null);

  // Close the profile menu on click outside or Escape
  useEffect(() => {
    if (!showDropdown) return;

    const handleClickOutside = (e) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    };

    const onKey = (e) => {
      if (e.key === 'Escape') setShowDropdown(false);
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    document.addEventListener('keydown', onKey);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
      document.removeEventListener('keydown', onKey);
    };
  }, [showDropdown]);

  const roleLabel = user ? ROLE_LABELS[user.role] || user.role : '';

  const getRoleBadgeClass = () => {
    if (user?.role === 'ADMIN') return 'role-badge-admin';
    if (user?.role === 'MANAGER') return 'role-badge-manager';
    return 'role-badge-executive';
  };

  return (
    <header className="top-navbar">
      <div className="navbar-left">
        <button
          className="mobile-menu-btn"
          onClick={onToggleMobileSidebar}
          aria-label="Toggle navigation menu"
          aria-expanded={mobileSidebarOpen}
          aria-controls="main-sidebar"
        >
          <Menu size={22} />
        </button>
        <div className="navbar-breadcrumb">
          <span className="navbar-project-tag">CRM Lite</span>
          <span className="navbar-divider">/</span>
          <span className="navbar-portal-title">Sales Workspace</span>
        </div>
      </div>

      <div className="navbar-right">
        {/* Theme Toggle Button */}
        <button
          type="button"
          className="navbar-theme-toggle-btn"
          onClick={toggleTheme}
          title={isDark ? 'Switch to White & Green Light Theme' : 'Switch to Dark Mode'}
          aria-label="Toggle color theme"
        >
          {isDark ? <Sun size={18} className="theme-icon-sun" /> : <Moon size={18} className="theme-icon-moon" />}
          <span className="theme-toggle-text">{isDark ? 'Light Mode' : 'Dark Mode'}</span>
        </button>

        {/* Live Notification Center Bell */}
        <NotificationBell />

        {/* Overdue follow-ups alert */}
        {overdueCount > 0 && (
          <Link
            to="/follow-ups"
            className="navbar-alert-link"
            title="Overdue follow-ups"
            aria-label={`${overdueCount} overdue follow-up${overdueCount === 1 ? '' : 's'}`}
          >
            <Clock size={18} />
            <span className="alert-count-pill">{overdueCount > 99 ? '99+' : overdueCount}</span>
          </Link>
        )}

        <div className={`navbar-role-pill ${getRoleBadgeClass()}`}>
          <Shield size={13} />
          <span>{roleLabel}</span>
        </div>

        <div className="user-profile-menu" ref={profileMenuRef}>
          <button
            type="button"
            className="user-profile-btn"
            onClick={() => setShowDropdown(!showDropdown)}
            aria-expanded={showDropdown}
          >
            <div className="user-avatar-circle">
              {getInitials(user?.first_name ? `${user.first_name} ${user.last_name}` : user?.email)}
            </div>
            <div className="user-details-compact">
              <span className="user-display-name">
                {user?.first_name ? `${user.first_name} ${user.last_name}` : user?.email?.split('@')[0]}
              </span>
              <span className="user-display-role">{user?.role?.toLowerCase()}</span>
            </div>
          </button>

          {showDropdown && (
            <div className="user-dropdown-card">
              <div className="dropdown-user-header">
                <strong>{user?.first_name} {user?.last_name}</strong>
                <span className="dropdown-email">{user?.email}</span>
              </div>
              <div className="dropdown-divider" />
              <Link
                to="/settings"
                className="dropdown-item"
                onClick={() => setShowDropdown(false)}
              >
                <UserIcon size={16} />
                <span>My Profile & Settings</span>
              </Link>
              <div className="dropdown-divider" />
              <button
                type="button"
                className="dropdown-item dropdown-logout"
                onClick={() => {
                  setShowDropdown(false);
                  logout();
                }}
              >
                <LogOut size={16} />
                <span>Sign Out</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
