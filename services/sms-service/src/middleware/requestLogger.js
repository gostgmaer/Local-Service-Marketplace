'use strict';

const logger = require('../utils/logger');
const { maskPhone } = require('../utils/phoneNormalizer');

function requestLogger(req, res, next) {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    const level = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info';
    logger[level]('HTTP request', {
      method: req.method,
      path: req.path,
      status: res.statusCode,
      durationMs: duration,
      ip: req.ip,
      tenantId: req.tenantId || req.headers['x-tenant-id'],
    });
  });
  next();
}

module.exports = requestLogger;
