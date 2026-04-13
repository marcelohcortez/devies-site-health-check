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

const express = require('express');
const cors    = require('cors');
const path    = require('path');

const { init }        = require('./db');
const auditRouter     = require('./routes/audit');

const app  = express();
const PORT = process.env.PORT || 3500;

// ── Middleware ───────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json({ limit: '1mb' }));

// ── Static (React build — local dev only, Vercel serves this separately) ─────
const CLIENT_DIST = path.join(__dirname, '..', 'client', 'dist');
app.use(express.static(CLIENT_DIST));

// ── API ──────────────────────────────────────────────────────────────────────
app.use('/api', auditRouter);

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
