import { useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../store/AuthContext.jsx';
import AuthBrandPanel from '../../components/auth/AuthBrandPanel.jsx';
import '../../styles/auth.css';

// ─── Icons ───────────────────────────────────────────────────────────────────
const IconUser  = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.582-7 8-7s8 3 8 7"/></svg>;
const IconMail  = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m2 7 10 7 10-7"/></svg>;
const IconLock  = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>;
const IconEye   = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z"/><circle cx="12" cy="12" r="3"/></svg>;
const IconEyeOff= () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.94 10.94 0 0 1 12 19c-7 0-11-7-11-7a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 7 11 7a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>;

// ─── Password strength ────────────────────────────────────────────────────────
function getStrength(pwd) {
  if (!pwd) return { score: 0, label: '', color: 'transparent' };
  let score = 0;
  if (pwd.length >= 8)  score++;
  if (/[A-Z]/.test(pwd)) score++;
  if (/[0-9]/.test(pwd)) score++;
  if (/[^A-Za-z0-9]/.test(pwd)) score++;
  const levels = [
    { label: 'Too short', color: '#ff5c72' },
    { label: 'Weak',      color: '#ff5c72' },
    { label: 'Fair',      color: '#ffa940' },
    { label: 'Good',      color: '#00b4d8' },
    { label: 'Strong',    color: '#00d084' },
  ];
  return { score, ...levels[score] };
}

// ─── Validation ───────────────────────────────────────────────────────────────
function validate({ loginId, email, password, confirmPassword }) {
  const errs = {};
  if (!loginId.trim())             errs.loginId = 'Login ID is required.';
  else if (!/^[a-zA-Z0-9_]{3,50}$/.test(loginId.trim()))
    errs.loginId = 'Only letters, numbers, underscores. 3–50 chars.';
  if (!email.trim())               errs.email = 'Email is required.';
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
    errs.email = 'Enter a valid email address.';
  if (!password)                   errs.password = 'Password is required.';
  else if (password.length < 8)    errs.password = 'Password must be at least 8 characters.';
  if (password !== confirmPassword) errs.confirmPassword = 'Passwords do not match.';
  return errs;
}

export default function SignupPage() {
  const { signup } = useAuth();
  const navigate   = useNavigate();

  const [form, setForm] = useState({ loginId: '', email: '', password: '', confirmPassword: '' });
  const [errors, setErrors]   = useState({});
  const [showPwd, setShowPwd] = useState(false);
  const [showCfm, setShowCfm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState('');

  const strength = getStrength(form.password);

  const handleChange = useCallback((e) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: '' }));
    setServerError('');
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validate(form);
    if (Object.keys(errs).length) { setErrors(errs); return; }

    setLoading(true);
    setServerError('');
    try {
      await signup({
        loginId: form.loginId.trim(),
        email:   form.email.trim(),
        password: form.password,
      });
      navigate('/');
    } catch (err) {
      setServerError(err?.response?.data?.error ?? 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-root">
      <AuthBrandPanel />

      <div className="auth-form-panel">
        <div className="auth-card">
          <div className="auth-card-header">
            <p className="eyebrow">Get started</p>
            <h1>Create account</h1>
            <p>Set up your StockSense workspace in seconds.</p>
          </div>

          {serverError && (
            <div className="form-alert form-alert--error" role="alert">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              {serverError}
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate>
            {/* Login ID */}
            <div className="form-group">
              <label htmlFor="loginId" className="form-label">Login ID</label>
              <div className="input-wrapper">
                <span className="input-icon"><IconUser /></span>
                <input id="loginId" name="loginId" type="text" autoComplete="username" autoFocus
                  className={`form-input${errors.loginId ? ' input-error' : ''}`}
                  placeholder="e.g. john_doe"
                  value={form.loginId} onChange={handleChange} disabled={loading} />
              </div>
              {errors.loginId && <p className="field-error">⚠ {errors.loginId}</p>}
            </div>

            {/* Email */}
            <div className="form-group">
              <label htmlFor="email" className="form-label">Email address</label>
              <div className="input-wrapper">
                <span className="input-icon"><IconMail /></span>
                <input id="email" name="email" type="email" autoComplete="email"
                  className={`form-input${errors.email ? ' input-error' : ''}`}
                  placeholder="john@company.com"
                  value={form.email} onChange={handleChange} disabled={loading} />
              </div>
              {errors.email && <p className="field-error">⚠ {errors.email}</p>}
            </div>

            {/* Password */}
            <div className="form-group">
              <label htmlFor="password" className="form-label">Password</label>
              <div className="input-wrapper">
                <span className="input-icon"><IconLock /></span>
                <input id="password" name="password" type={showPwd ? 'text' : 'password'}
                  autoComplete="new-password"
                  className={`form-input has-action${errors.password ? ' input-error' : ''}`}
                  placeholder="••••••••"
                  value={form.password} onChange={handleChange} disabled={loading} />
                <button type="button" className="input-action"
                  onClick={() => setShowPwd((v) => !v)}
                  aria-label={showPwd ? 'Hide' : 'Show'}>
                  {showPwd ? <IconEyeOff /> : <IconEye />}
                </button>
              </div>
              {/* Strength bar */}
              {form.password && (
                <div>
                  <div className="strength-bar">
                    <div className="strength-fill"
                      style={{ width: `${(strength.score / 4) * 100}%`, background: strength.color }} />
                  </div>
                  <p style={{ fontSize: '0.76rem', color: strength.color, marginTop: '4px' }}>
                    {strength.label}
                  </p>
                </div>
              )}
              {errors.password && <p className="field-error">⚠ {errors.password}</p>}
            </div>

            {/* Confirm Password */}
            <div className="form-group">
              <label htmlFor="confirmPassword" className="form-label">Confirm password</label>
              <div className="input-wrapper">
                <span className="input-icon"><IconLock /></span>
                <input id="confirmPassword" name="confirmPassword"
                  type={showCfm ? 'text' : 'password'}
                  autoComplete="new-password"
                  className={`form-input has-action${errors.confirmPassword ? ' input-error' : ''}`}
                  placeholder="••••••••"
                  value={form.confirmPassword} onChange={handleChange} disabled={loading} />
                <button type="button" className="input-action"
                  onClick={() => setShowCfm((v) => !v)}
                  aria-label={showCfm ? 'Hide' : 'Show'}>
                  {showCfm ? <IconEyeOff /> : <IconEye />}
                </button>
              </div>
              {errors.confirmPassword && <p className="field-error">⚠ {errors.confirmPassword}</p>}
            </div>

            <div style={{ marginTop: '8px' }}>
              <button type="submit" className="btn btn-primary" disabled={loading} id="signup-submit-btn">
                {loading ? <><span className="spinner" />Creating account…</> : 'Create account'}
              </button>
            </div>
          </form>

          <div className="divider">or</div>

          <div className="auth-footer">
            Already have an account?{' '}
            <Link to="/login" className="auth-link">Sign in</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
