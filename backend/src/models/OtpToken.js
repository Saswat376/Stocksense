import { query } from '../config/db.js';

export const OtpToken = {
  /**
   * Create a new OTP record.
   * Any previous unused OTPs for the same user+purpose are deleted first.
   */
  create: async ({ userId, otpCode, purpose = 'password_reset', ttlMinutes = 10 }) => {
    // Invalidate old pending OTPs for this user/purpose
    await query(
      'DELETE FROM otp_tokens WHERE user_id = $1 AND purpose = $2 AND used = false',
      [userId, purpose],
    );
    return query(
      `INSERT INTO otp_tokens (user_id, otp_code, purpose, expires_at)
       VALUES ($1, $2, $3, NOW() + INTERVAL '${ttlMinutes} minutes')
       RETURNING *`,
      [userId, otpCode, purpose],
    );
  },

  /**
   * Find a valid (not expired, not used) OTP for the given user/purpose.
   */
  findValid: (userId, otpCode, purpose = 'password_reset') =>
    query(
      `SELECT * FROM otp_tokens
       WHERE user_id = $1 AND otp_code = $2 AND purpose = $3
         AND used = false AND expires_at > NOW()
       LIMIT 1`,
      [userId, otpCode, purpose],
    ),

  /** Mark an OTP as used */
  markUsed: (id) =>
    query('UPDATE otp_tokens SET used = true WHERE id = $1', [id]),
};
