'use strict';

const config = require('../config');
const { AppError } = require('../utils/errorHandler');
const { ERROR_CODES } = require('../utils/constants');
const logger = require('../utils/logger');

// TENANCY_ENABLED=true  → x-tenant-id (or DEFAULT_TENANT_ID) is enforced; 400 if missing.
// TENANCY_ENABLED=false → tenant is optional; req.tenantId = null and the service continues.
const TENANCY_ENABLED   = config.tenant.enabled;
const DEFAULT_TENANT_ID = config.tenant.defaultTenantId || null;

/**
 * Resolves req.tenantId from header or DEFAULT_TENANT_ID fallback.
 * Returns 400 only when TENANCY_ENABLED=true and no tenant can be resolved.
 */
function resolveTenant(req, res, next) {
  const tenantId = (req.headers['x-tenant-id'] || DEFAULT_TENANT_ID || '').trim();
  if (!tenantId) {
    if (TENANCY_ENABLED) {
      return next(new AppError(
        'Missing X-Tenant-Id header. Set DEFAULT_TENANT_ID in the service env or pass the header explicitly.',
        400,
        ERROR_CODES.VALIDATION_ERROR,
      ));
    }
    req.tenantId = null;
    return next();
  }
  req.tenantId = tenantId;
  next();
}

/**
 * API Key authentication middleware.
 * Expects: Authorization: Bearer <API_KEY>
 */
function authMiddleware(req, res, next) {
  const authHeader = req.headers['authorization'] || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;

  if (!config.auth.apiKey) {
    if (process.env.NODE_ENV === 'production') {
      // Hard-fail: never silently allow in production without a key configured
      return next(new AppError('Server misconfiguration: API_KEY is not set', 500, ERROR_CODES.INTERNAL_ERROR));
    }
    // Dev-only passthrough with a visible warning
    logger.warn('API_KEY not set — authentication is disabled (dev mode only)');
    return resolveTenant(req, res, next);
  }

  if (!token || token !== config.auth.apiKey) {
    return next(new AppError('Invalid or missing API key', 401, ERROR_CODES.UNAUTHORIZED));
  }

  resolveTenant(req, res, next);
}

module.exports = authMiddleware;
