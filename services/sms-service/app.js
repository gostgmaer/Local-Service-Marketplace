'use strict';

require('dotenv').config();

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const requestLogger = require('./src/middleware/requestLogger');
const { globalLimiter } = require('./src/middleware/rateLimiter');
const { errorHandler, notFoundHandler } = require('./src/utils/errorHandler');
const routes = require('./src/routes');
const logger = require('./src/utils/logger');

const app = express();

// ─── Security & Parsing ───────────────────────────────────────────────────────
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',') : '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Tenant-Id'],
}));
app.use(compression());
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

// ─── Request Logging ─────────────────────────────────────────────────────────
app.use(requestLogger);

// ─── Global Rate Limit ───────────────────────────────────────────────────────
app.use(globalLimiter);

// ─── Response serializer — renames _id → id, removes __v ─────────────────────
// ─── Request ID + Response envelope ──────────────────────────────────────────────
// Injects: timestamp, requestId, statusCode, status into every JSON response.
// Also serialises _id → id (string), strips __v, strips null values, sets headers.
app.use((req, res, next) => {
  if (!req.requestId) {
    req.requestId = req.headers['x-request-id'] || require('crypto').randomUUID();
  }
  res.setHeader('X-Request-ID', req.requestId);
  const _json = res.json.bind(res);
  res.json = function (body) {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    if (body !== null && body !== undefined && typeof body === 'object' && !Array.isArray(body)) {
      body.timestamp  = new Date().toISOString();
      body.requestId  = req.requestId;
      body.statusCode = res.statusCode;
      body.status     = res.statusCode < 400 ? 'success' : 'error';
    }
    return _json(_cleanResponse(body));
  };
  next();
});

function _cleanResponse(val) {
  if (val === null || val === undefined) return undefined;
  if (typeof val !== 'object') return val;
  if (val instanceof Date) return val;
  if (Buffer.isBuffer(val)) return val;
  if (Array.isArray(val)) return val.map(_cleanResponse).filter(v => v !== undefined);
  const src = typeof val.toJSON === 'function' ? val.toJSON() : val;
  if (typeof src !== 'object' || src === null) return src;
  const out = {};
  for (const key of Object.keys(src)) {
    if (key === '__v' || key === '_id' || key === 'id' ||
        key === 'isDeleted' || key === 'deletedAt' ||
        key === 'created_by' || key === 'updated_by' || key === 'deleted_by') continue;
    const v = _cleanResponse(src[key]);
    if (v !== undefined) out[key] = v;
  }
  const rawId = src.id !== undefined ? src.id : src._id;
  if (rawId !== undefined) out.id = String(rawId);
  return out;
}

// ─── Routes ──────────────────────────────────────────────────────────────────
const API_PREFIX = process.env.API_PREFIX || '/api/v1';
app.use(API_PREFIX, routes);

// ─── 404 & Error Handling ─────────────────────────────────────────────────────
app.use(notFoundHandler);
app.use(errorHandler);

// ─── Unhandled Rejections & Exceptions ───────────────────────────────────────
process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled rejection', { reason: reason?.message || reason });
});
process.on('uncaughtException', (err) => {
  logger.error('Uncaught exception', { error: err.message, stack: err.stack });
  process.exit(1);
});

module.exports = app;
