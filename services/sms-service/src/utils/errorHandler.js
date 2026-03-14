'use strict';

const logger = require('./logger');
const { ERROR_CODES } = require('./constants');

class AppError extends Error {
  constructor(message, statusCode = 500, errorCode = ERROR_CODES.INTERNAL_ERROR, details = null) {
    super(message);
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.details = details;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

// Central error response handler
function errorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
  const statusCode = err.statusCode || 500;
  const isOperational = err.isOperational === true;

  if (!isOperational) {
    logger.error('Unexpected error', {
      error: err.message,
      stack: err.stack,
      path: req.path,
      method: req.method,
    });
  }

  res.status(statusCode).json({
    success: false,
    errorCode: err.errorCode || ERROR_CODES.INTERNAL_ERROR,
    message: isOperational ? err.message : 'An unexpected error occurred',
    ...(err.details && { details: err.details }),
  });
}

function notFoundHandler(req, res) {
  res.status(404).json({
    success: false,
    errorCode: ERROR_CODES.NOT_FOUND,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
  });
}

module.exports = { AppError, errorHandler, notFoundHandler };
