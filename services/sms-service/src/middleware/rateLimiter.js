'use strict';

const rateLimit = require('express-rate-limit');
const config = require('../config');
const logger = require('../utils/logger');
const { ERROR_CODES } = require('../utils/constants');

function createLimiter(options = {}) {
  return rateLimit({
    windowMs: config.rateLimit.windowMs,
    max: options.max || config.rateLimit.maxGlobal,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: options.keyGenerator,
    handler: (req, res) => {
      res.status(429).json({
        success: false,
        errorCode: ERROR_CODES.RATE_LIMIT_EXCEEDED,
        message: 'Too many requests. Please slow down.',
      });
    },
  });
}

// Global rate limiter (IP-based)
const globalLimiter = createLimiter({ max: config.rateLimit.maxGlobal });

// Per-tenant rate limiter for SMS send endpoints
const smsSendLimiter = createLimiter({
  max: config.rateLimit.maxPerTenant,
  keyGenerator: (req) => {
    const tenantId = req.tenantId || req.headers['x-tenant-id'] || req.ip;
    return `sms_send:${tenantId}`;
  },
});

module.exports = { globalLimiter, smsSendLimiter };
