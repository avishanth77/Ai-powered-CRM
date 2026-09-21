import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { Compass, LogIn, Lock, Mail, ArrowRight, ShieldCheck } from 'lucide-react';
import { extractErrorMessage } from '../utils/validation';

export const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const { login } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  const from = location.state?.from?.pathname || '/dashboard';

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please provide both email and password.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const user = await login(email, password);
      showToast(`Welcome back, ${user.first_name || user.email}!`, 'success');
      navigate(from, { replace: true });
    } catch (err) {
      const msg = extractErrorMessage(err, 'Invalid credentials. Please try again.');
      setError(msg);
      showToast(msg, 'error');
    } finally {
      setLoading(false);
    }
  };

  const fillCredentials = (quickEmail, quickPassword) => {
    setEmail(quickEmail);
    setPassword(quickPassword);
    setError('');
  };

  return (
    <div className="auth-page-container">
      <div className="auth-card">
        <div className="auth-header">
          <div className="auth-brand-badge">
            <Compass size={16} />
            <span>CRM Lite v1.0</span>
          </div>
          <h1 className="auth-title">Sales Workspace</h1>
          <p className="auth-subtitle">Sign in to manage leads, follow-ups & customer pipelines</p>
        </div>

        {error && (
          <div className="toast-item toast-error mb-4" style={{ marginBottom: '1.25rem' }}>
            <div className="toast-message">{error}</div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="form-layout">
          <div className="form-group">
            <label className="form-label" htmlFor="login-email">Email Address</label>
            <div className="search-bar-container" style={{ width: '100%' }}>
              <Mail size={18} className="search-icon" />
              <input
                id="login-email"
                type="email"
                className="search-input"
                placeholder="name@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="login-password">Password</label>
            <div className="search-bar-container" style={{ width: '100%' }}>
              <Lock size={18} className="search-icon" />
              <input
                id="login-password"
                type="password"
                className="search-input"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', marginTop: '0.5rem', padding: '0.75rem' }}
            disabled={loading}
          >
            {loading ? 'Authenticating...' : (
              <>
                <span>Sign In to CRM</span>
                <ArrowRight size={18} />
              </>
            )}
          </button>
        </form>

        <div className="quick-login-box">
          <div className="quick-login-title">Quick Demo Sign-In</div>
          <div className="quick-login-buttons">
            <button
              type="button"
              className="quick-role-btn"
              onClick={() => fillCredentials('admin@crmlite.com', 'Admin@123')}
            >
              Admin / Mentor
            </button>
            <button
              type="button"
              className="quick-role-btn"
              onClick={() => fillCredentials('manager@crmlite.com', 'Manager@123')}
            >
              Sales Manager
            </button>
            <button
              type="button"
              className="quick-role-btn"
              onClick={() => fillCredentials('alex@crmlite.com', 'Alex@123')}
            >
              Sales Executive
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
