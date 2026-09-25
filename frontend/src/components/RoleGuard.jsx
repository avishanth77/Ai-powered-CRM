import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ShieldAlert } from 'lucide-react';

export const RoleGuard = ({ allowedRoles = [], fallback = null, children }) => {
  const { user } = useAuth();

  if (!user) return fallback;

  const isAllowed = allowedRoles.length === 0 || allowedRoles.includes(user.role);

  if (!isAllowed) {
    if (fallback) return fallback;
    return (
      <div className="card" style={{ textAlign: 'center', padding: '3rem', maxWidth: '560px', margin: '2rem auto' }}>
        <ShieldAlert size={40} color="var(--warning)" style={{ margin: '0 auto 1rem' }} />
        <h3>Access restricted</h3>
        <p className="text-muted" style={{ margin: '0.5rem 0 1.5rem' }}>
          Your current role does not have permission to view this section.
        </p>
        <Link to="/dashboard" className="btn btn-primary">
          Back to Dashboard
        </Link>
      </div>
    );
  }

  return children;
};
