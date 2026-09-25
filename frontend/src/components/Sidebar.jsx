import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard,
  Users2,
  Kanban,
  Clock,
  Briefcase,
  BarChart3,
  UserCog,
  Settings,
  X,
  Compass,
  Calendar,
  Bell,
} from 'lucide-react';

export const Sidebar = ({ isMobileOpen, onCloseMobile }) => {
  const { user, isAdmin, isManager, isExecutive } = useAuth();

  const navItems = [
    {
      label: 'Dashboard',
      path: '/dashboard',
      icon: LayoutDashboard,
      show: true,
    },
    {
      label: isExecutive ? 'My Leads' : 'Leads',
      path: '/leads',
      icon: Users2,
      show: true,
    },
    {
      label: 'Pipeline',
      path: '/pipeline',
      icon: Kanban,
      show: true,
    },
    {
      label: 'Calendar',
      path: '/calendar',
      icon: Calendar,
      show: true,
    },
    {
      label: isExecutive ? 'My Follow-ups' : 'Follow-ups',
      path: '/follow-ups',
      icon: Clock,
      show: true,
    },
    {
      label: 'Customers',
      path: '/customers',
      icon: Briefcase,
      show: true,
    },
    {
      label: isExecutive ? 'My Performance' : 'Reports & Analytics',
      path: '/reports',
      icon: BarChart3,
      show: true,
    },
    {
      label: 'User Management',
      path: '/users',
      icon: UserCog,
      show: isAdmin || isManager,
    },
    {
      label: 'Notifications',
      path: '/notifications',
      icon: Bell,
      show: true,
    },
    {
      label: 'Settings',
      path: '/settings',
      icon: Settings,
      show: true,
    },
  ];

  return (
    <>
      {isMobileOpen && <div className="sidebar-backdrop" onClick={onCloseMobile} />}
      <aside className={`main-sidebar ${isMobileOpen ? 'mobile-open' : ''}`}>
        <div className="sidebar-brand">
          <div className="brand-logo-icon">
            <Compass size={22} />
          </div>
          <div className="brand-text">
            <h2 className="brand-name">CRM Lite</h2>
            <span className="brand-subtitle">Sales & Follow-Up</span>
          </div>
          <button className="mobile-close-btn" onClick={onCloseMobile} aria-label="Close menu">
            <X size={20} />
          </button>
        </div>

        <nav className="sidebar-nav">
          <div className="sidebar-section-title">Navigation</div>
          {navItems
            .filter((item) => item.show)
            .map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={({ isActive }) =>
                    `sidebar-link ${isActive ? 'sidebar-link-active' : ''}`
                  }
                  onClick={onCloseMobile}
                >
                  <Icon size={19} className="nav-icon" />
                  <span>{item.label}</span>
                </NavLink>
              );
            })}
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-team-status">
            <span className="status-ping" />
            <span className="status-label">
              {user?.role === 'ADMIN' && 'System Admin Mode'}
              {user?.role === 'MANAGER' && 'Sales Manager Mode'}
              {user?.role === 'EXECUTIVE' && 'Executive Rep Mode'}
            </span>
          </div>
        </div>
      </aside>
    </>
  );
};
