import * as authService from '../services/auth.service.js';

// POST /api/auth/signup
export async function signup(req, res, next) {
  try {
    const { loginId, email, password } = req.body;
    const result = await authService.register({ loginId, email, password });
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}

// POST /api/auth/login
export async function login(req, res, next) {
  try {
    const { loginId, password } = req.body;
    const result = await authService.login({ loginId, password });
    res.json(result);
  } catch (err) {
    next(err);
  }
}

// POST /api/auth/forgot-password
export async function forgotPassword(req, res, next) {
  try {
    const { loginId } = req.body;
    await authService.requestPasswordReset(loginId);
    // Always return 200 to prevent login-id enumeration
    res.json({ message: 'If that account exists, an OTP has been sent to the registered email.' });
  } catch (err) {
    next(err);
  }
}

// POST /api/auth/verify-otp
export async function verifyOtp(req, res, next) {
  try {
    const { loginId, otpCode } = req.body;
    const result = await authService.verifyOtp({ loginId, otpCode });
    res.json(result);
  } catch (err) {
    next(err);
  }
}

// POST /api/auth/reset-password
export async function resetPassword(req, res, next) {
  try {
    const { resetToken, newPassword } = req.body;
    await authService.resetPassword({ resetToken, newPassword });
    res.json({ message: 'Password updated successfully.' });
  } catch (err) {
    next(err);
  }
}

// GET /api/auth/me  (requires requireAuth middleware)
export async function me(req, res) {
  res.json({ user: req.user });
}
