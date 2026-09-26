import { useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { authApi } from '../../api/authApi.js';
import AuthBrandPanel from '../../components/auth/AuthBrandPanel.jsx';
import '../../styles/auth.css';

const IconUser = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.582-7 8-7s8 3 8 7"/></svg>;

export default function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [loginId, setLoginId]     = useState('');
  const [loading, setLoading]     = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError]         = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!loginId.trim()) { setError('Please enter your Login ID.'); return; }
    setLoading(true);
    setError('');
    try {
      await authApi.forgotPassword({ loginId: loginId.trim() });
      setSubmitted(true);
    } catch {
      // Even on error, show success to avoid enumeration
      setSubmitted(true);
    } finally {
      setLoading(false);
    }
  };

  const handleContinue = useCallback(() => {
    // Navigate to OTP verification with the loginId stored in state
    navigate('/verify-otp', { state: { loginId: loginId.trim() } });
  }, [navigate, loginId]);

  return (
    <div className="auth-root">
      <AuthBrandPanel />

      <div className="auth-form-panel">
        <div className="auth-card">
          {!submitted ? (
            <>
              <div className="auth-card-header">
                <p className="eyebrow">Account recovery</p>
                <h1>Forgot password?</h1>
                <p>Enter your Login ID and we&apos;ll send a one-time code to your registered email.</p>
              </div>

              {error && (
                <div className="form-alert form-alert--error" role="alert">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} noValidate>
                <div className="form-group">
                  <label htmlFor="loginId" className="form-label">Login ID</label>
                  <div className="input-wrapper">
                    <span className="input-icon"><IconUser /></span>
                    <input
                      id="loginId"
                      name="loginId"
                      type="text"
                      autoFocus
                      autoComplete="username"
                      className="form-input"
                      placeholder="e.g. john_doe"
                      value={loginId}
                      onChange={(e) => { setLoginId(e.target.value); setError(''); }}
                      disabled={loading}
                    />
                  </div>
                </div>

                <button type="submit" className="btn btn-primary" disabled={loading} id="forgot-submit-btn">
                  {loading ? <><span className="spinner" />Sending OTP…</> : 'Send OTP'}
                </button>
              </form>

              <div className="auth-footer" style={{ marginTop: '20px' }}>
                <Link to="/login" className="auth-link">← Back to sign in</Link>
              </div>
            </>
          ) : (
            <>
              <div className="auth-card-header">
                <div style={{
                  width: 64, height: 64,
                  background: 'rgba(0,208,132,0.12)',
                  border: '1px solid rgba(0,208,132,0.3)',
                  borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  marginBottom: 20,
                }}>
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#00d084" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                    <polyline points="22,6 12,13 2,6"/>
                  </svg>
                </div>
                <p className="eyebrow">Check your email</p>
                <h1>OTP sent!</h1>
                <p>
                  If <strong style={{ color: 'var(--clr-text-primary)' }}>{loginId}</strong> is
                  registered, a 6-digit code has been sent to the associated email.
                  It expires in <strong style={{ color: 'var(--clr-brand-500)' }}>10 minutes</strong>.
                </p>
              </div>

              <button
                className="btn btn-primary"
                onClick={handleContinue}
                id="otp-continue-btn"
              >
                Enter OTP →
              </button>

              <div className="auth-footer" style={{ marginTop: '20px' }}>
                <Link to="/login" className="auth-link">← Back to sign in</Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
