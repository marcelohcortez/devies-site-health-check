'use strict';

/**
 * routes/auth.js
 *
 * POST /api/auth/login
 *   Body: { username, password }
 *   Returns: { token } on success, 401 on failure.
 *
 * Credentials come from env vars:
 *   ADMIN_USERNAME         — plaintext username
 *   ADMIN_PASSWORD_HASH    — bcrypt hash (cost ≥ 12) — generate with scripts/hash-password.js
 *   JWT_SECRET             — min 32 chars
 */

const express = require('express');
const bcrypt  = require('bcrypt');
const jwt     = require('jsonwebtoken');

const { sanitizeCredential } = require('../lib/sanitize');

const router = express.Router();

router.post('/login', async (req, res) => {
  const raw = req.body || {};

  if (typeof raw.username !== 'string' || typeof raw.password !== 'string') {
    return res.status(401).json({ error: 'Invalid credentials.' });
  }

  // Sanitize: strip null bytes only — preserve all other chars (passwords may contain them intentionally).
  const username = sanitizeCredential(raw.username.trim());
  const password = sanitizeCredential(raw.password);

  const expectedUsername = process.env.ADMIN_USERNAME;
  const passwordHash     = process.env.ADMIN_PASSWORD_HASH;
  const secret           = process.env.JWT_SECRET;

  if (!expectedUsername || !passwordHash || !secret) {
    console.error('[auth] Missing ADMIN_USERNAME, ADMIN_PASSWORD_HASH, or JWT_SECRET env vars');
    return res.status(500).json({ error: 'Server misconfiguration.' });
  }

  // Constant-time username comparison (compare length first to avoid short-circuit)
  const usernameMatch = username.length === expectedUsername.length && username === expectedUsername;

  // Always run bcrypt.compare regardless of username match (prevents timing attacks)
  let passwordMatch = false;
  try {
    passwordMatch = await bcrypt.compare(password, passwordHash);
  } catch {
    return res.status(500).json({ error: 'Internal error.' });
  }

  if (!usernameMatch || !passwordMatch) {
    return res.status(401).json({ error: 'Invalid credentials.' });
  }

  const token = jwt.sign(
    { sub: username },
    secret,
    { expiresIn: '8h', algorithm: 'HS256' }
  );

  const isProd = process.env.NODE_ENV !== 'development';

  return res
    .cookie('auditAdminToken', token, {
      httpOnly: true,
      secure:   isProd,      // HTTPS-only in production
      sameSite: 'strict',
      maxAge:   8 * 60 * 60 * 1000,  // 8 h in ms
      path:     '/',
    })
    .json({ ok: true });
});

// POST /api/auth/logout — clear the session cookie
router.post('/logout', (_req, res) => {
  res
    .clearCookie('auditAdminToken', { path: '/' })
    .json({ ok: true });
});

module.exports = router;
