import { useState, useRef, useEffect, useCallback } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { authApi } from '../../api/authApi.js';
import AuthBrandPanel from '../../components/auth/AuthBrandPanel.jsx';
import '../../styles/auth.css';

const RESEND_COOLDOWN = 60; // seconds

export default function VerifyOtpPage() {
  const navigate  = useNavigate();
  const location  = useLocation();
  const loginId   = location.state?.loginId ?? '';

  const [digits, setDigits]   = useState(Array(6).fill(''));
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const [resendSecs, setResendSecs] = useState(RESEND_COOLDOWN);
  const [resending, setResending]   = useState(false);

  const inputRefs = useRef([]);

  // Redirect if arrived without loginId
  useEffect(() => {
    if (!loginId) navigate('/forgot-password', { replace: true });
  }, [loginId, navigate]);

  // Countdown timer for resend button
  useEffect(() => {
    if (resendSecs <= 0) return;
    const t = setTimeout(() => setResendSecs((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendSecs]);

  const focusInput = useCallback((idx) => {
    inputRefs.current[idx]?.focus();
  }, []);

  const handleDigitChange = (idx, val) => {
    // Allow only digits
    const clean = val.replace(/\D/g, '').slice(-1);
    const next = [...digits];
    next[idx] = clean;
    setDigits(next);
    setError('');
    if (clean && idx < 5) focusInput(idx + 1);
  };

  const handleKeyDown = (idx, e) => {
    if (e.key === 'Backspace' && !digits[idx] && idx > 0) {
      focusInput(idx - 1);
    }
    if (e.key === 'ArrowLeft'  && idx > 0) focusInput(idx - 1);
    if (e.key === 'ArrowRight' && idx < 5) focusInput(idx + 1);
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!pasted) return;
    const next = Array(6).fill('');
    pasted.split('').forEach((ch, i) => { next[i] = ch; });
    setDigits(next);
    focusInput(Math.min(pasted.length, 5));
  };

  const otpCode = digits.join('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (otpCode.length < 6) { setError('Please enter all 6 digits.'); return; }
    setLoading(true);
    setError('');
    try {
      const { data } = await authApi.verifyOtp({ loginId, otpCode });
      navigate('/reset-password', { state: { resetToken: data.resetToken } });
    } catch (err) {
      setError(err?.response?.data?.error ?? 'Invalid or expired OTP. Please try again.');
      setDigits(Array(6).fill(''));
      focusInput(0);
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setResending(true);
    setError('');
    try {
      await authApi.forgotPassword({ loginId });
    } catch { /* silent */ } finally {
      setResendSecs(RESEND_COOLDOWN);
      setResending(false);
      setDigits(Array(6).fill(''));
      focusInput(0);
    }
  };

  return (
    <div className="auth-root">
      <AuthBrandPanel />

      <div className="auth-form-panel">
        <div className="auth-card">
          <div className="auth-card-header">
            <div style={{
              width: 56, height: 56,
              background: 'rgba(0,208,132,0.12)',
              border: '1px solid rgba(0,208,132,0.3)',
              borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              marginBottom: 18,
            }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#00d084" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 2H3v16h5l3 3 3-3h7V2z"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="9" y1="12" x2="13" y2="12"/>
              </svg>
            </div>
            <p className="eyebrow">Verification</p>
            <h1>Enter OTP</h1>
            <p>
              Enter the 6-digit code sent to the email registered with{' '}
              <strong style={{ color: 'var(--clr-text-primary)' }}>{loginId}</strong>.
            </p>
          </div>

          {error && (
            <div className="form-alert form-alert--error" role="alert">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate>
            <div className="form-group">
              <label className="form-label" style={{ textAlign: 'center', display: 'block' }}>
                6-digit code
              </label>
              <div className="otp-inputs" onPaste={handlePaste}>
                {digits.map((d, i) => (
                  <input
                    key={i}
                    ref={(el) => { inputRefs.current[i] = el; }}
                    id={`otp-digit-${i}`}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    className={`otp-digit${d ? ' filled' : ''}`}
                    value={d}
                    onChange={(e) => handleDigitChange(i, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(i, e)}
                    disabled={loading}
                    autoFocus={i === 0}
                    autoComplete="one-time-code"
                    aria-label={`OTP digit ${i + 1}`}
                  />
                ))}
              </div>

              <div className="resend-row">
                {resendSecs > 0 ? (
                  <>
                    Resend code in{' '}
                    <span style={{ color: 'var(--clr-brand-500)', fontVariantNumeric: 'tabular-nums' }}>
                      {String(Math.floor(resendSecs / 60)).padStart(2,'0')}:{String(resendSecs % 60).padStart(2,'0')}
                    </span>
                  </>
                ) : (
                  <>
                    Didn&apos;t receive it?{' '}
                    <button
                      type="button"
                      className="resend-btn"
                      onClick={handleResend}
                      disabled={resending}
                    >
                      {resending ? 'Sending…' : 'Resend OTP'}
                    </button>
                  </>
                )}
              </div>
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading || otpCode.length < 6}
              id="verify-otp-btn"
            >
              {loading ? <><span className="spinner" />Verifying…</> : 'Verify OTP'}
            </button>
          </form>

          <div className="auth-footer" style={{ marginTop: '20px' }}>
            <Link to="/forgot-password" className="auth-link">← Try a different Login ID</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
