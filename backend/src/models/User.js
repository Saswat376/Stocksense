import { query } from '../config/db.js';

export const User = {
  /** Find a user by their login_id */
  findByLoginId: (loginId) =>
    query('SELECT * FROM users WHERE login_id = $1 LIMIT 1', [loginId]),

  /** Find a user by their email */
  findByEmail: (email) =>
    query('SELECT * FROM users WHERE email = $1 LIMIT 1', [email]),

  /** Find a user by their id */
  findById: (id) =>
    query('SELECT id, login_id, email, role, is_active, created_at FROM users WHERE id = $1 LIMIT 1', [id]),

  /** Create a new user — role must be pre-derived from loginId prefix */
  create: ({ loginId, email, passwordHash, role }) =>
    query(
      `INSERT INTO users (login_id, email, password_hash, role)
       VALUES ($1, $2, $3, $4)
       RETURNING id, login_id, email, role, is_active, created_at`,
      [loginId, email, passwordHash, role],
    ),

  /** Update password hash for a user */
  updatePassword: (userId, passwordHash) =>
    query(
      'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2',
      [passwordHash, userId],
    ),
};
