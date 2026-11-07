import React, { useEffect, useRef, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
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
  Bot,
  Package,
  ChevronDown,
  Shield,
  Layers,
  ListChecks,
  Sparkles,
  Globe,
  UserCheck,
} from 'lucide-react';

export const Sidebar = ({ isMobileOpen, onCloseMobile }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const {
    user,
    isAdmin,
    isManager,
    isExecutive,
    canManageStages,
    canManageSources,
    canManageIcp,
    canManagePld,
    canManageTaskRules,
  } = useAuth();

  const asideRef = useRef(null);
  const [isMobileViewport, setIsMobileViewport] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(max-width: 768px)').matches
  );

  const isSettingsActive = location.pathname.startsWith('/settings');
  const searchParams = new URLSearchParams(location.search);
  const activeTabParam = searchParams.get('tab');
  const defaultSettingsTab = canManageStages ? 'stages' : 'profile';

  // Open settings dropdown automatically if user is on any /settings URL
  const [settingsOpen, setSettingsOpen] = useState(isSettingsActive);

  useEffect(() => {
    if (isSettingsActive) {
      setSettingsOpen(true);
    }
  }, [isSettingsActive]);

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
      label: 'AI Center',
      path: '/ai',
      icon: Bot,
      show: true,
    },
  ];

  const settingsSubItems = [
    {
      label: 'Lead Stage Management',
      tab: 'stages',
      icon: Kanban,
      show: canManageStages || isAdmin,
    },
    {
      label: 'Profile & Security',
      tab: 'profile',
      icon: Shield,
      show: true,
    },
    {
      label: 'Lead Sources',
      tab: 'sources',
      icon: Layers,
      show: canManageSources || isAdmin,
    },
    {
      label: 'ICP Questions',
      tab: 'icp',
      icon: ListChecks,
      show: canManageIcp || isAdmin,
    },
    {
      label: 'Stage Tasks & Rules',
      tab: 'tasks',
      icon: Sparkles,
      show: canManageTaskRules || canManagePld || isAdmin || isManager,
    },
    {
      label: 'Web-to-Lead API',
      tab: 'web-to-lead',
      icon: Globe,
      show: canManageSources || canManageStages || isAdmin || isManager,
    },
    {
      label: 'Products Catalog',
      tab: 'products',
      icon: Package,
      show: isAdmin || isManager,
    },
    {
      label: 'Lead Auto-Assignment',
      tab: 'assignment',
      icon: UserCheck,
      show: isAdmin || isManager,
    },
  ];

  const visibleSettingsSubItems = settingsSubItems.filter((i) => i.show);

  const handleToggleSettings = () => {
    if (!settingsOpen) {
      setSettingsOpen(true);
      if (!isSettingsActive) {
        navigate(`/settings?tab=${defaultSettingsTab}`);
        if (isMobileViewport) onCloseMobile();
      }
    } else {
      setSettingsOpen(false);
    }
  };

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

          {/* Settings Section Header */}
          <div className="sidebar-section-title" style={{ marginTop: '0.75rem' }}>Configuration</div>

          {/* Settings Dropdown Accordion */}
          <div className="sidebar-dropdown-group">
            <button
              type="button"
              className={`sidebar-link sidebar-dropdown-toggle ${isSettingsActive ? 'sidebar-link-active' : ''}`}
              onClick={handleToggleSettings}
              aria-expanded={settingsOpen}
              aria-controls="sidebar-settings-submenu"
              title="Settings & Configuration"
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <Settings size={19} className="nav-icon" />
                <span>Settings</span>
              </div>
              <ChevronDown
                size={16}
                className="chevron-icon"
                style={{
                  transform: settingsOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                  transition: 'transform 0.2s ease',
                }}
              />
            </button>

            {settingsOpen && (
              <div id="sidebar-settings-submenu" className="sidebar-submenu" role="menu">
                {visibleSettingsSubItems.map((subItem) => {
                  const SubIcon = subItem.icon;
                  const isSubActive =
                    isSettingsActive &&
                    (activeTabParam === subItem.tab ||
                      (!activeTabParam && subItem.tab === defaultSettingsTab));

                  return (
                    <NavLink
                      key={subItem.tab}
                      to={`/settings?tab=${subItem.tab}`}
                      className={`sidebar-sublink ${isSubActive ? 'sidebar-sublink-active' : ''}`}
                      onClick={onCloseMobile}
                      role="menuitem"
                    >
                      <SubIcon size={14} className="sublink-icon" />
                      <span>{subItem.label}</span>
                    </NavLink>
                  );
                })}
              </div>
            )}
          </div>
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

export default Sidebar;
