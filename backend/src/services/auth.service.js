import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User } from '../models/User.js';
import { OtpToken } from '../models/OtpToken.js';
import { generateOtp, sendOtpEmail } from '../utils/otp.utils.js';
import { env } from '../config/env.js';

const SALT_ROUNDS = 12;

// ─── helpers ────────────────────────────────────────────────────────────────

/**
 * Derive role from the login ID prefix.
 * Login ID must be exactly 12 characters.
 *   Manag....... → 'manager'
 *   Staff....... → 'staff'
 * Returns null if the format is invalid.
 */
export function deriveRole(loginId) {
  if (!loginId || loginId.length !== 12) return null;
  if (loginId.startsWith('Manag')) return 'manager';
  if (loginId.startsWith('Staff')) return 'staff';
  return null;
}

function makeToken(user) {
  return jwt.sign(
    { sub: user.id, loginId: user.login_id, role: user.role },
    env.jwtSecret,
    { expiresIn: env.jwtExpiresIn },
  );
}

function createError(message, status = 400) {
  const err = new Error(message);
  err.status = status;
  return err;
}

// ─── service functions ───────────────────────────────────────────────────────

/**
 * Register a new user.
 * Role is derived from the login ID prefix — it is never accepted from the client.
 */
export async function register({ loginId, email, password }) {
  // Validate login ID format: exactly 12 chars, starts with 'Manag' or 'Staff'
  const role = deriveRole(loginId);
  if (!role) {
    throw createError(
      'Invalid Login ID. Must be exactly 12 characters and start with "Manag" (manager) or "Staff" (warehouse staff).',
    );
  }

  // Check if login_id is taken
  const { rows: byLogin } = await User.findByLoginId(loginId);
  if (byLogin.length) throw createError('Login ID is already taken.');

  // Check if email is taken
  const { rows: byEmail } = await User.findByEmail(email);
  if (byEmail.length) throw createError('Email is already registered.');

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  const { rows } = await User.create({ loginId, email, passwordHash, role });
  const user = rows[0];

  return { user, token: makeToken(user) };
}

/**
 * Authenticate with loginId + password.
 */
export async function login({ loginId, password }) {
  const { rows } = await User.findByLoginId(loginId);
  const user = rows[0];
  if (!user) throw createError('Invalid login ID or password.', 401);

  if (!user.is_active) throw createError('Account is deactivated. Contact support.', 403);

  const match = await bcrypt.compare(password, user.password_hash);
  if (!match) throw createError('Invalid login ID or password.', 401);

  // Strip hash before returning
  const { password_hash: _ph, ...safeUser } = user;
  return { user: safeUser, token: makeToken(user) };
}

/**
 * Request a password-reset OTP. Always sends the OTP to email but
 * returns a generic success message to avoid email enumeration.
 */
export async function requestPasswordReset(loginId) {
  const { rows } = await User.findByLoginId(loginId);
  const user = rows[0];

  // Silently succeed if not found (anti-enumeration)
  if (!user || !user.is_active) return;

  const otp = generateOtp();
  await OtpToken.create({ userId: user.id, otpCode: otp });
  await sendOtpEmail(user.email, otp);
}

/**
 * Verify OTP and issue a short-lived reset token.
 * Returns a resetToken that the client exchanges in the next step.
 */
export async function verifyOtp({ loginId, otpCode }) {
  const { rows: userRows } = await User.findByLoginId(loginId);
  const user = userRows[0];
  if (!user) throw createError('Invalid or expired OTP.', 400);

  const { rows: otpRows } = await OtpToken.findValid(user.id, otpCode);
  if (!otpRows.length) throw createError('Invalid or expired OTP.', 400);

  await OtpToken.markUsed(otpRows[0].id);

  // Issue a short-lived (15 min) reset token so the client can call resetPassword
  const resetToken = jwt.sign(
    { sub: user.id, purpose: 'password_reset' },
    env.jwtSecret,
    { expiresIn: '15m' },
  );
  return { resetToken };
}

/**
 * Set a new password using the reset token issued after OTP verification.
 */
export async function resetPassword({ resetToken, newPassword }) {
  let payload;
  try {
    payload = jwt.verify(resetToken, env.jwtSecret);
  } catch {
    throw createError('Reset token is invalid or expired.', 400);
  }
  if (payload.purpose !== 'password_reset') throw createError('Invalid token.', 400);

  const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
  await User.updatePassword(payload.sub, passwordHash);
}
