#!/usr/bin/env node
'use strict';

/**
 * scripts/hash-password.js
 *
 * Generates a bcrypt hash for the given plaintext password.
 * Use this to set ADMIN_PASSWORD_HASH in your .env file.
 *
 * Usage:
 *   node scripts/hash-password.js "your-password-here"
 *
 * Then copy the output into api/.env:
 *   ADMIN_PASSWORD_HASH=$2b$12$...
 */

const bcrypt = require(require.resolve('bcrypt', { paths: [require('path').join(__dirname, '..', 'api')] }));

const password = process.argv[2];

if (!password) {
  console.error('Usage: node scripts/hash-password.js "your-password-here"');
  process.exit(1);
}

if (password.length < 8) {
  console.error('Password must be at least 8 characters.');
  process.exit(1);
}

bcrypt.hash(password, 12).then(hash => {
  console.log(hash);
}).catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
