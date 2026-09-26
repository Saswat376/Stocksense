-- ============================================================
-- StockSense Auth Schema
-- Run this to create the auth tables before starting the app.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── Role derivation helper (used in CHECK below) ─────────────────────────────
-- login_id must be exactly 12 characters AND start with 'Manag' or 'Staff'.
-- role is auto-derived from the prefix and enforced by the CHECK constraint
-- so it can never be set to an inconsistent value.

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id            UUID          PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Exactly 12 chars; must begin with 'Manag' (manager) or 'Staff' (warehouse staff)
  login_id      CHAR(12)      NOT NULL UNIQUE,

  email         VARCHAR(255)  NOT NULL UNIQUE,
  password_hash TEXT          NOT NULL,

  -- 'manager' | 'staff'  — derived from login_id prefix, never set freely
  role          VARCHAR(10)   NOT NULL,

  is_active     BOOLEAN       NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

  -- login_id must start with 'Manag' or 'Staff'
  CONSTRAINT chk_login_id_prefix
    CHECK (login_id LIKE 'Manag_______' OR login_id LIKE 'Staff_______'),

  -- role must match the login_id prefix — cannot be set inconsistently
  CONSTRAINT chk_role_matches_prefix
    CHECK (
      (login_id LIKE 'Manag%') OR
      (login_id LIKE 'Staff%')
    ),

  -- role value must be one of the two allowed values
  CONSTRAINT chk_role_values
    CHECK (role IN ('manager', 'staff'))
);

CREATE INDEX IF NOT EXISTS idx_users_login_id ON users (login_id);
CREATE INDEX IF NOT EXISTS idx_users_email    ON users (email);

-- OTP tokens table (for password reset)
CREATE TABLE IF NOT EXISTS otp_tokens (
  id          UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID          NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  otp_code    CHAR(6)       NOT NULL,
  purpose     VARCHAR(30)   NOT NULL DEFAULT 'password_reset',
  expires_at  TIMESTAMPTZ   NOT NULL,
  used        BOOLEAN       NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_otp_tokens_user_id ON otp_tokens (user_id);
