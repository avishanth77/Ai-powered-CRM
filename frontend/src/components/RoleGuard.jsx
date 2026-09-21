import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export const RoleGuard = ({ allowedRoles = [], fallback = null, children }) => {
  const { user } = useAuth();

  if (!user) return fallback;

  const isAllowed = allowedRoles.length === 0 || allowedRoles.includes(user.role);

  if (!isAllowed) {
    return fallback ? fallback : <Navigate to="/dashboard" replace />;
  }

  return children;
};
