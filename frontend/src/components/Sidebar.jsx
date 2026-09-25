import React, { useEffect, useRef, useState } from 'react';
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
  const asideRef = useRef(null);
  const [isMobileViewport, setIsMobileViewport] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(max-width: 768px)').matches
  );

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)');
    const onChange = (e) => setIsMobileViewport(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  // Mobile drawer behavior: Escape closes, background scroll locks, focus moves in.
  useEffect(() => {
    if (!isMobileOpen) return;
    const onKey = (e) => {
      if (e.key === 'Escape') onCloseMobile();
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    asideRef.current?.querySelector('.sidebar-link')?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [isMobileOpen, onCloseMobile]);

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
      <aside
        id="main-sidebar"
        ref={asideRef}
        className={`main-sidebar ${isMobileOpen ? 'mobile-open' : ''}`}
        inert={isMobileViewport && !isMobileOpen ? true : undefined}
      >
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

        <nav className="sidebar-nav" aria-label="Primary navigation">
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
