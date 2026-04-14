'use strict';

/**
 * lib/sanitize.js — Input sanitization helpers
 *
 * sanitizeText(str, maxLen?)
 *   Use for display strings stored in the DB (name, email, URL).
 *   - Strips C0/C1 control characters and Unicode line/paragraph separators.
 *   - Strips HTML/XML tags so stored values are plain text.
 *   - Trims leading/trailing whitespace.
 *   - Truncates to maxLen (optional, as a safety net — primary length checks
 *     happen before sanitization in the route handler).
 *
 * sanitizeCredential(str)
 *   Use for authentication inputs (username, password).
 *   - Strips only null bytes — preserves all other characters including
 *     whitespace, since users may intentionally include them in passwords.
 *
 * escapeHtml(str)
 *   Use before interpolating any string into an HTML template (email body).
 *   Escapes the five characters that are meaningful in HTML: & < > " '
 */

// Control characters to strip from display strings:
//   C0: U+0000–U+0008, U+000B (VT), U+000C (FF), U+000E–U+001F
//   DEL: U+007F
//   C1: U+0085 (NEL), U+2028 (line sep), U+2029 (paragraph sep)
// We keep: U+0009 (TAB), U+000A (LF), U+000D (CR) — legitimately printable.
const CONTROL_RE = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u0085\u2028\u2029]/g;

// Matches any HTML/XML tag (opening, closing, self-closing, or comment).
const HTML_TAG_RE = /<[^>]*>/g;

/**
 * Sanitize a plain-text display string.
 * @param {string} str
 * @param {number} [maxLen=Infinity]
 * @returns {string}
 */
function sanitizeText(str, maxLen = Infinity) {
  return str
    .trim()
    .replace(CONTROL_RE, '')
    .replace(HTML_TAG_RE, '')
    .slice(0, maxLen);
}

/**
 * Sanitize an authentication credential (username or password).
 * Only removes null bytes; all other characters are preserved.
 * @param {string} str
 * @returns {string}
 */
function sanitizeCredential(str) {
  return str.replace(/\u0000/g, '');
}

/**
 * Escape characters that are meaningful in HTML.
 * Must be applied whenever a string is interpolated into an HTML template.
 * @param {string} str
 * @returns {string}
 */
function escapeHtml(str) {
  return str
    .replace(/&/g,  '&amp;')
    .replace(/</g,  '&lt;')
    .replace(/>/g,  '&gt;')
    .replace(/"/g,  '&quot;')
    .replace(/'/g,  '&#x27;');
}

module.exports = { sanitizeText, sanitizeCredential, escapeHtml };
