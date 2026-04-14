'use strict';

/**
 * server.js — Express app
 *
 * Exports the app for Vercel (serverless).
 * Calls app.listen() only when run directly (local dev).
 *
 * PORT: env var PORT or 3500
 */

require('dotenv').config();

const express   = require('express');
const cors      = require('cors');
const helmet    = require('helmet');
const rateLimit = require('express-rate-limit');
const path      = require('path');

const { init }        = require('./db');
const auditRouter     = require('./routes/audit');
const authRouter      = require('./routes/auth');

const app  = express();
const PORT = process.env.PORT || 3500;

// ── Security headers ─────────────────────────────────────────────────────────
app.use(helmet({
  // API server — relax CSP (no inline scripts served here)
  contentSecurityPolicy: false,
}));

// ── CORS — public for /api/audit (embeddable widget), all origins allowed ────
app.use(cors());

// ── Rate limiting ─────────────────────────────────────────────────────────────
// POST /api/audit is expensive (makes real HTTP requests per URL).
// Limit: 5 audit requests per IP per hour (override via RATE_LIMIT_MAX_AUDIT).
const auditLimiter = rateLimit({
  windowMs:        60 * 60 * 1000,
  max:             parseInt(process.env.RATE_LIMIT_MAX_AUDIT || '5', 10),
  standardHeaders: true,
  legacyHeaders:   false,
  message:         { error: 'Too many audit requests from this IP. Try again in an hour.' },
});

// Lighter limit on read endpoints.
const readLimiter = rateLimit({
  windowMs:        15 * 60 * 1000,
  max:             100,
  standardHeaders: true,
  legacyHeaders:   false,
  message:         { error: 'Too many requests. Try again shortly.' },
});

// Strict limit on login attempts.
const loginLimiter = rateLimit({
  windowMs:        15 * 60 * 1000,
  max:             10,
  standardHeaders: true,
  legacyHeaders:   false,
  message:         { error: 'Too many login attempts. Try again in 15 minutes.' },
});

app.use('/api/audit',       auditLimiter);
app.use('/api/submissions', readLimiter);
app.use('/api/auth/login',  loginLimiter);

// ── Body parser ───────────────────────────────────────────────────────────────
app.use(express.json({ limit: '1mb' }));

// ── Static (React build — local dev only, Vercel serves this separately) ─────
const CLIENT_DIST = path.join(__dirname, '..', 'client', 'dist');
app.use(express.static(CLIENT_DIST));

// ── API ──────────────────────────────────────────────────────────────────────
app.use('/api/auth', authRouter);
app.use('/api',      auditRouter);

// ── SPA fallback ─────────────────────────────────────────────────────────────
app.get('*', (_req, res) => {
  res.sendFile(path.join(CLIENT_DIST, 'index.html'));
});

// ── Export for Vercel (serverless) ───────────────────────────────────────────
module.exports = app;

// ── Local dev: init DB then start listening ──────────────────────────────────
if (require.main === module) {
  init()
    .then(() => {
      app.listen(PORT, () => {
        console.log(`[audit-web] Server running → http://localhost:${PORT}`);
      });
    })
    .catch(err => {
      console.error('[audit-web] DB init failed:', err.message);
      process.exit(1);
    });
}
