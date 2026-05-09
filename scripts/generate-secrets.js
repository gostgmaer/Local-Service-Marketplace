#!/usr/bin/env node
// Generates all required crypto secrets and prints them ready to paste
// into secrets.local.env
//
// Usage:
//   pnpm secrets:generate
//   node scripts/generate-secrets.js

const crypto = require('crypto');

const rand = (bytes) => crypto.randomBytes(bytes).toString('base64');

const secrets = [
  ['LSP_JWT_SECRET',              rand(48)],
  ['LSP_JWT_REFRESH_SECRET',      rand(48)],
  ['LSP_GATEWAY_INTERNAL_SECRET', rand(48)],
  ['LSP_SESSION_SECRET',          rand(32)],
  ['LSP_AUTH_SECRET',             rand(32)],
  ['LSP_ENCRYPTION_KEY',          rand(64)],
  ['LSP_POSTGRES_PASSWORD',       rand(32)],
  ['LSP_REDIS_PASSWORD',          rand(32)],
];

console.log('\n# Copy these into secrets.local.env\n');
for (const [key, val] of secrets) {
  console.log(`${key}=${val}`);
}
console.log('');
