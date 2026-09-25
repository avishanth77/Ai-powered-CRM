import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Compass, ArrowLeft } from 'lucide-react';

export const NotFound = () => {
  useEffect(() => {
    const prev = document.title;
    document.title = '404 — Page Not Found';
    return () => {
      document.title = prev;
    };
  }, []);
  return (
    <div className="auth-page-container">
      <div className="auth-card" style={{ textAlign: 'center' }}>
        <Compass size={48} color="var(--primary-light)" style={{ margin: '0 auto 1rem' }} />
        <h1 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>404</h1>
        <h3 style={{ marginBottom: '1rem' }}>Page Not Found</h3>
        <p className="text-muted" style={{ marginBottom: '1.5rem' }}>
          The CRM view or record you are looking for does not exist or has been relocated.
        </p>
        <Link to="/dashboard" className="btn btn-primary" style={{ display: 'inline-flex' }}>
          <ArrowLeft size={16} /> Return to Dashboard
        </Link>
      </div>
    </div>
  );
};
