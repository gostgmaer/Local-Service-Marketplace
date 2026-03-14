'use strict';

const express = require('express');
const router = express.Router();

const ctrl = require('../controllers/sms.controller');
const authMiddleware = require('../middleware/auth');
const { smsSendLimiter } = require('../middleware/rateLimiter');
const validate = require('../middleware/validate');
const {
  sendSmsRules,
  sendOtpRules,
  verifyOtpRules,
  getMessageRules,
  listMessagesRules,
} = require('../validators/sms.validator');
const { sendBulkRules } = require('../validators/bulk.validator');

// All SMS routes require authentication
router.use(authMiddleware);

// Send OTP (rate-limited)
router.post('/send-otp', smsSendLimiter, sendOtpRules, validate, ctrl.sendOtpHandler);

// Verify OTP
router.post('/verify-otp', verifyOtpRules, validate, ctrl.verifyOtpHandler);

// Send single SMS (rate-limited)
router.post('/send', smsSendLimiter, sendSmsRules, validate, ctrl.send);

// Send bulk SMS
router.post('/send-bulk', smsSendLimiter, sendBulkRules, validate, ctrl.sendBulkSms);

// List messages
router.get('/', listMessagesRules, validate, ctrl.list);

// Get message by ID
router.get('/:messageId', getMessageRules, validate, ctrl.getById);

// GDPR purge
router.delete('/:messageId/gdpr-purge', getMessageRules, validate, ctrl.gdprPurge);

module.exports = router;
