'use strict';

/**
 * middleware/auth.js
 *
 * verifyJwt — Express middleware that checks the HttpOnly `auditAdminToken` cookie.
 * Attaches decoded payload to req.admin on success.
 * Returns 401 JSON on missing / invalid / expired token.
 */

const jwt                    = require('jsonwebtoken');
const { parse: parseCookies } = require('cookie');

function verifyJwt(req, res, next) {
  const cookies = parseCookies(req.headers.cookie || '');
  const token   = cookies.auditAdminToken;

  if (!token) {
    return res.status(401).json({ error: 'Authentication required.' });
  }

  const secret = process.env.JWT_SECRET;

  if (!secret) {
    console.error('[auth] JWT_SECRET env var is not set');
    return res.status(500).json({ error: 'Server misconfiguration.' });
  }

  try {
    const payload  = jwt.verify(token, secret);
    req.admin      = payload;
    return next();
  } catch (err) {
    const msg = err.name === 'TokenExpiredError' ? 'Session expired. Please log in again.' : 'Invalid token.';
    return res.status(401).json({ error: msg });
  }
}

module.exports = { verifyJwt };
