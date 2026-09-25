import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { authApi } from '../api/authApi';
import { Compass, Lock, Mail, ArrowRight, KeyRound, X } from 'lucide-react';
import { extractErrorMessage } from '../utils/validation';

export const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Forgot Password modal state
  const [forgotModalOpen, setForgotModalOpen] = useState(false);
  const [forgotStep, setForgotStep] = useState(1); // 1: request code, 2: set new password
  const [resetEmail, setResetEmail] = useState('');
  const [resetTokenData, setResetTokenData] = useState({ uid: '', token: '' });
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [resetError, setResetError] = useState('');

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

  const handleForgotSubmit = async (e) => {
    e.preventDefault();
    if (!resetEmail.trim()) {
      setResetError('Please enter your email address.');
      return;
    }
    setResetLoading(true);
    setResetError('');
    try {
      const res = await authApi.forgotPassword(resetEmail.trim());
      if (res.data) {
        setResetTokenData({ uid: res.data.uid, token: res.data.token });
      }
      setForgotStep(2);
      showToast('Verification token generated. Please enter your new password.', 'info');
    } catch (err) {
      setResetError(extractErrorMessage(err, 'Could not find an account with that email.'));
    } finally {
      setResetLoading(false);
    }
  };

  const handleResetSubmit = async (e) => {
    e.preventDefault();
    if (newPassword !== confirmNewPassword) {
      setResetError('Passwords do not match.');
      return;
    }
    if (newPassword.length < 6) {
      setResetError('Password must be at least 6 characters.');
      return;
    }
    setResetLoading(true);
    setResetError('');
    try {
      const res = await authApi.resetPassword({
        uid: resetTokenData.uid,
        token: resetTokenData.token,
        new_password: newPassword,
        confirm_new_password: confirmNewPassword,
      });
      showToast(res.message || 'Password reset successfully! You can now log in.', 'success');
      setEmail(resetEmail);
      setPassword('');
      setForgotModalOpen(false);
      setForgotStep(1);
      setResetEmail('');
      setNewPassword('');
      setConfirmNewPassword('');
    } catch (err) {
      setResetError(extractErrorMessage(err, 'Failed to reset password.'));
    } finally {
      setResetLoading(false);
    }
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
          <div className="toast-item toast-error mb-4" style={{ marginBottom: '1.25rem' }} role="alert">
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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.375rem' }}>
              <label className="form-label" htmlFor="login-password" style={{ marginBottom: 0 }}>Password</label>
              <button
                type="button"
                onClick={() => {
                  setForgotModalOpen(true);
                  setForgotStep(1);
                  setResetEmail(email || '');
                  setResetError('');
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--primary-light)',
                  fontSize: '0.75rem',
                  fontWeight: 500,
                  cursor: 'pointer',
                  padding: 0,
                  textDecoration: 'underline'
                }}
              >
                Forgot password?
              </button>
            </div>
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

      {/* Forgot Password Modal */}
      {forgotModalOpen && (
        <div className="modal-backdrop" onClick={() => setForgotModalOpen(false)}>
          <div className="modal-container" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '440px' }}>
            <div className="modal-header">
              <div className="modal-title-row">
                <KeyRound size={20} color="var(--primary)" />
                <h3 className="modal-title" style={{ fontSize: '1.125rem', margin: 0 }}>
                  {forgotStep === 1 ? 'Forgot Password' : 'Set New Password'}
                </h3>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setForgotModalOpen(false)}
                aria-label="Close modal"
              >
                <X size={18} />
              </button>
            </div>

            <div className="modal-body">
              <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '1.25rem' }}>
                {forgotStep === 1
                  ? 'Enter the email address registered with your CRM account to initiate a secure password reset.'
                  : `Enter and confirm a new password for ${resetEmail}.`}
              </p>

              {resetError && (
                <div className="toast-item toast-error mb-4" style={{ marginBottom: '1rem' }}>
                  <div className="toast-message" style={{ fontSize: '0.8125rem' }}>{resetError}</div>
                </div>
              )}

              {forgotStep === 1 ? (
                <form onSubmit={handleForgotSubmit} className="form-layout">
                  <div className="form-group">
                    <label className="form-label" htmlFor="reset-email">Account Email</label>
                    <div className="search-bar-container" style={{ width: '100%' }}>
                      <Mail size={18} className="search-icon" />
                      <input
                        id="reset-email"
                        type="email"
                        className="search-input"
                        placeholder="name@company.com"
                        value={resetEmail}
                        onChange={(e) => setResetEmail(e.target.value)}
                        required
                        autoFocus
                      />
                    </div>
                  </div>

                  <div className="modal-actions" style={{ marginTop: '1.25rem' }}>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => setForgotModalOpen(false)}
                      disabled={resetLoading}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="btn btn-primary"
                      disabled={resetLoading || !resetEmail.trim()}
                    >
                      {resetLoading ? 'Validating...' : 'Continue'}
                    </button>
                  </div>
                </form>
              ) : (
                <form onSubmit={handleResetSubmit} className="form-layout">
                  <div className="form-group">
                    <label className="form-label" htmlFor="reset-new-password">New Password</label>
                    <div className="search-bar-container" style={{ width: '100%' }}>
                      <Lock size={18} className="search-icon" />
                      <input
                        id="reset-new-password"
                        type="password"
                        className="search-input"
                        placeholder="At least 6 characters"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        required
                        minLength={6}
                        autoFocus
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label" htmlFor="reset-confirm-password">Confirm Password</label>
                    <div className="search-bar-container" style={{ width: '100%' }}>
                      <Lock size={18} className="search-icon" />
                      <input
                        id="reset-confirm-password"
                        type="password"
                        className="search-input"
                        placeholder="Re-enter new password"
                        value={confirmNewPassword}
                        onChange={(e) => setConfirmNewPassword(e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  <div className="modal-actions" style={{ marginTop: '1.25rem' }}>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => setForgotStep(1)}
                      disabled={resetLoading}
                    >
                      Back
                    </button>
                    <button
                      type="submit"
                      className="btn btn-primary"
                      disabled={resetLoading || !newPassword || !confirmNewPassword}
                    >
                      {resetLoading ? 'Resetting...' : 'Reset Password'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
