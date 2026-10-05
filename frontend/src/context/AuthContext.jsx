import React, { createContext, useContext, useState, useEffect } from 'react';
import { authApi } from '../api/authApi';
import { USER_ROLES } from '../utils/constants';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('crm_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('crm_access_token');
    if (token) {
      authApi
        .getMe()
        .then((res) => {
          if (res.success && res.data) {
            setUser(res.data);
            localStorage.setItem('crm_user', JSON.stringify(res.data));
          }
        })
        .catch(() => {
          // If token invalid, axios interceptor handles refresh or logout
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (email, password) => {
    const res = await authApi.login(email, password);
    if (res.success && res.data) {
      const { access, refresh, user: userData } = res.data;
      localStorage.setItem('crm_access_token', access);
      localStorage.setItem('crm_refresh_token', refresh);
      localStorage.setItem('crm_user', JSON.stringify(userData));
      setUser(userData);
      return userData;
    }
    throw new Error(res.message || 'Login failed');
  };

  const logout = async () => {
    const refresh = localStorage.getItem('crm_refresh_token');
    await authApi.logout(refresh);
    localStorage.removeItem('crm_access_token');
    localStorage.removeItem('crm_refresh_token');
    localStorage.removeItem('crm_user');
    setUser(null);
  };

  const updateUserProfile = (updatedData) => {
    const merged = { ...user, ...updatedData };
    setUser(merged);
    localStorage.setItem('crm_user', JSON.stringify(merged));
  };

  const isAdmin = user?.role === USER_ROLES.ADMIN;
  const isManager = user?.role === USER_ROLES.MANAGER;
  const isExecutive = user?.role === USER_ROLES.EXECUTIVE;
  const isManagerOrAdmin = isAdmin || isManager;

  const value = {
    user,
    loading,
    login,
    logout,
    updateUserProfile,
    isAuthenticated: !!user,
    isAdmin,
    isManager,
    isExecutive,
    isManagerOrAdmin,
    canAssignLeads: isManagerOrAdmin,
    canHandoverLeads: isManagerOrAdmin,
    canConvertLeads: isManagerOrAdmin,
    canDeleteLeads: isAdmin,
    canExportReports: isManagerOrAdmin,
    canManageUsers: isAdmin,
    canManageSources: isManagerOrAdmin,
    canManageStages: isAdmin,
    canManageIcp: isManagerOrAdmin,
  };


  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
