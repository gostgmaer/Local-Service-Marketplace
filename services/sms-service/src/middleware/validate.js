'use strict';

const { validationResult } = require('express-validator');
const { ERROR_CODES } = require('../utils/constants');

/**
 * Run after express-validator chains. Returns 422 if any errors exist.
 */
function validate(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({
      success: false,
      errorCode: ERROR_CODES.VALIDATION_ERROR,
      message: 'Validation failed',
      details: errors.array().map((e) => ({ field: e.path, message: e.msg })),
    });
  }
  next();
}

module.exports = validate;
