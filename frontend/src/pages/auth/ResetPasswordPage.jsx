import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { authApi } from '../../api/authApi.js';
import AuthBrandPanel from '../../components/auth/AuthBrandPanel.jsx';
import '../../styles/auth.css';

const IconLock  = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>;
const IconEye   = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z"/><circle cx="12" cy="12" r="3"/></svg>;
const IconEyeOff= () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.94 10.94 0 0 1 12 19c-7 0-11-7-11-7a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 7 11 7a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>;

export default function ResetPasswordPage() {
  const navigate  = useNavigate();
  const location  = useLocation();
  const resetToken = location.state?.resetToken ?? '';

  const [form, setForm]     = useState({ password: '', confirm: '' });
  const [showP, setShowP]   = useState(false);
  const [showC, setShowC]   = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState('');
  const [done, setDone]     = useState(false);

  // Guard: redirect if no token
  if (!resetToken && !done) {
    return (
      <div className="auth-root">
        <AuthBrandPanel />
        <div className="auth-form-panel">
          <div className="auth-card">
            <div className="auth-card-header">
              <h1>Invalid link</h1>
              <p>This page requires a valid reset token. Please start again.</p>
            </div>
            <Link to="/forgot-password" className="btn btn-primary" style={{ textDecoration: 'none', display: 'flex', justifyContent: 'center' }}>
              Start password reset
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const handleChange = (e) => {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    if (form.password !== form.confirm) { setError('Passwords do not match.'); return; }
    setLoading(true);
    setError('');
    try {
      await authApi.resetPassword({ resetToken, newPassword: form.password });
      setDone(true);
    } catch (err) {
      setError(err?.response?.data?.error ?? 'Failed to reset password. The link may have expired.');
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <div className="auth-root">
        <AuthBrandPanel />
        <div className="auth-form-panel">
          <div className="auth-card">
            <div style={{
              width: 64, height: 64,
              background: 'rgba(0,208,132,0.12)',
              border: '1px solid rgba(0,208,132,0.3)',
              borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              marginBottom: 24,
            }}>
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#00d084" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            </div>
            <div className="auth-card-header">
              <p className="eyebrow">All done</p>
              <h1>Password updated!</h1>
              <p>Your password has been changed successfully. You can now sign in with your new password.</p>
            </div>
            <button
              className="btn btn-primary"
              onClick={() => navigate('/login')}
              id="goto-login-btn"
            >
              Go to sign in
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-root">
      <AuthBrandPanel />
      <div className="auth-form-panel">
        <div className="auth-card">
          <div className="auth-card-header">
            <p className="eyebrow">Last step</p>
            <h1>New password</h1>
            <p>Choose a strong password for your account. It must be at least 8 characters.</p>
          </div>

          {error && (
            <div className="form-alert form-alert--error" role="alert">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate>
            <div className="form-group">
              <label htmlFor="rp-password" className="form-label">New password</label>
              <div className="input-wrapper">
                <span className="input-icon"><IconLock /></span>
                <input
                  id="rp-password"
                  name="password"
                  type={showP ? 'text' : 'password'}
                  autoFocus
                  autoComplete="new-password"
                  className="form-input has-action"
                  placeholder="••••••••"
                  value={form.password}
                  onChange={handleChange}
                  disabled={loading}
                />
                <button type="button" className="input-action"
                  onClick={() => setShowP((v) => !v)}
                  aria-label={showP ? 'Hide' : 'Show'}>
                  {showP ? <IconEyeOff /> : <IconEye />}
                </button>
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="rp-confirm" className="form-label">Confirm new password</label>
              <div className="input-wrapper">
                <span className="input-icon"><IconLock /></span>
                <input
                  id="rp-confirm"
                  name="confirm"
                  type={showC ? 'text' : 'password'}
                  autoComplete="new-password"
                  className="form-input has-action"
                  placeholder="••••••••"
                  value={form.confirm}
                  onChange={handleChange}
                  disabled={loading}
                />
                <button type="button" className="input-action"
                  onClick={() => setShowC((v) => !v)}
                  aria-label={showC ? 'Hide' : 'Show'}>
                  {showC ? <IconEyeOff /> : <IconEye />}
                </button>
              </div>
              {/* Match indicator */}
              {form.confirm && (
                <p style={{ fontSize: '0.76rem', marginTop: 4,
                  color: form.password === form.confirm ? 'var(--clr-brand-500)' : 'var(--clr-error)' }}>
                  {form.password === form.confirm ? '✓ Passwords match' : '✗ Passwords do not match'}
                </p>
              )}
            </div>

            <button type="submit" className="btn btn-primary" disabled={loading} id="reset-password-btn">
              {loading ? <><span className="spinner" />Updating…</> : 'Update password'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
