'use strict';

/**
 * db.js — Turso (libSQL) store for audit submissions
 *
 * All operations are async — Turso is a remote DB accessed over HTTP.
 * For local dev without Turso, set DATABASE_URL=file:./data/submissions.db
 * and omit DATABASE_AUTH_TOKEN.
 */

require('dotenv').config();

const { createClient } = require('@libsql/client');

const db = createClient({
  url:       process.env.DATABASE_URL        || 'file:./data/submissions.db',
  authToken: process.env.DATABASE_AUTH_TOKEN || undefined,
});

// ── Schema ────────────────────────────────────────────────────────────────────

async function init() {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS submissions (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      name       TEXT    NOT NULL,
      email      TEXT    NOT NULL,
      url        TEXT    NOT NULL,
      score      INTEGER,
      platform   TEXT,
      data_json  TEXT,
      created_at TEXT    DEFAULT (datetime('now'))
    )
  `);
  await db.execute(
    'CREATE INDEX IF NOT EXISTS idx_email      ON submissions(email)'
  );
  await db.execute(
    'CREATE INDEX IF NOT EXISTS idx_created_at ON submissions(created_at)'
  );
}

// ── Queries ───────────────────────────────────────────────────────────────────

/**
 * Save one audit submission.
 * Deletes any existing row for the same URL first (always fresh).
 */
async function saveSubmission({ name, email, url, score, platform, dataJson }) {
  await db.execute({ sql: 'DELETE FROM submissions WHERE url = ?', args: [url] });
  await db.execute({
    sql:  'INSERT INTO submissions (name, email, url, score, platform, data_json) VALUES (?, ?, ?, ?, ?, ?)',
    args: [
      name,
      email,
      url,
      score    ?? null,
      platform ?? null,
      dataJson ? JSON.stringify(dataJson) : null,
    ],
  });
}

/**
 * Return all submissions newest-first, without data_json.
 */
async function listSubmissions() {
  const result = await db.execute(
    'SELECT id, name, email, url, score, platform, created_at FROM submissions ORDER BY created_at DESC'
  );
  return result.rows;
}

/**
 * Return the raw audit_data object for one submission.
 */
async function getSubmissionData(id) {
  const result = await db.execute({
    sql:  'SELECT data_json FROM submissions WHERE id = ?',
    args: [id],
  });
  const row = result.rows[0];
  if (!row || !row.data_json) return null;
  return JSON.parse(row.data_json);
}

module.exports = { init, saveSubmission, listSubmissions, getSubmissionData };
