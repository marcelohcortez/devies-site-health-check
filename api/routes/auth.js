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

const router = express.Router();

router.post('/login', async (req, res) => {
  const { username, password } = req.body || {};

  if (typeof username !== 'string' || typeof password !== 'string') {
    return res.status(401).json({ error: 'Invalid credentials.' });
  }

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

  return res.json({ token });
});

module.exports = router;
