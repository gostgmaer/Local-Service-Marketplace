'use strict';

const { v4: uuidv4 } = require('uuid');
const SmsLog = require('../models/SmsLog');
const OtpStore = require('../models/OtpStore');
const SmsTemplate = require('../models/SmsTemplate');
const { getProvider, getFallbackProvider } = require('../config/providers');
const { normalisePhone } = require('../utils/phoneNormalizer');
const { render, calculateSegments } = require('../utils/templateEngine');
const { AppError } = require('../utils/errorHandler');
const logger = require('../utils/logger');
const config = require('../config');

const MAX_ATTEMPTS = config.sms.maxRetries || 3;
const TRANSIENT_CODES = new Set(['ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND', 'ERR_NETWORK', 'EAI_AGAIN']);

function _retryDelay(attempt) {
  const delays = [30 * 1000, 2 * 60 * 1000, 10 * 60 * 1000];
  return delays[Math.min(attempt, delays.length - 1)];
}

function _generateOtp(length = 6) {
  let otp = '';
  while (otp.length < length) {
    otp += Math.floor(Math.random() * 10).toString();
  }
  return otp;
}

async function _resolveMessage(payload) {
  if (payload.templateId) {
    const tpl = await SmsTemplate.findById(payload.templateId).lean();
    if (!tpl) throw new AppError(`Template ${payload.templateId} not found`, 404, 'SMS_NOT_FOUND');
    const rendered = render(tpl.body, payload.variables || {});
    return { message: rendered, template: tpl };
  }
  return { message: payload.message, template: null };
}

async function sendSms(payload, tenantId) {
  const normalised = normalisePhone(payload.to);
  const { message, template } = await _resolveMessage(payload);
  const messageId = uuidv4();

  // Idempotency check
  if (payload.referenceId) {
    const existing = await SmsLog.findOne({ referenceId: payload.referenceId, tenantId }).lean();
    if (existing) {
      logger.info({ messageId: existing.messageId, referenceId: payload.referenceId }, 'Duplicate referenceId — returning existing log');
      return existing;
    }
  }

  const log = await SmsLog.create({
    messageId,
    tenantId,
    to: normalised,
    from: payload.from,
    message,
    messageType: payload.messageType || 'TRANSACTIONAL',
    status: 'QUEUED',
    provider: config.sms.provider,
    referenceId: payload.referenceId,
    templateId: template?._id,
    dltTemplateId: payload.dltTemplateId || template?.dltTemplateId,
    dltEntityId: payload.dltEntityId || template?.dltEntityId,
    unicode: payload.unicode || false,
    segmentCount: calculateSegments(message),
    metadata: payload.metadata || {},
  });

  const provider = getProvider();
  let result;

  try {
    result = await provider.send({
      to: normalised,
      from: payload.from,
      message,
      unicode: payload.unicode,
      referenceId: payload.referenceId || messageId,
      dltTemplateId: log.dltTemplateId,
      dltEntityId: log.dltEntityId,
      messageType: log.messageType,
      metadata: payload.metadata,
    });
  } catch (err) {
    result = {
      success: false,
      status: 'FAILED',
      providerMessageId: null,
      rawResponse: { error: err.message },
    };
  }

  const transient = _isTransientError(result);
  const nextStatus = result.success ? 'SENT' : (transient ? 'RETRYING' : 'FAILED');

  const attemptEntry = {
    attemptNumber: 1,
    provider: config.sms.provider,
    status: result.success ? 'SENT' : 'FAILED',
    error: result.success ? undefined : (result.rawResponse?.error || 'Provider error'),
    timestamp: new Date(),
    rawResponse: result.rawResponse,
  };

  await SmsLog.findByIdAndUpdate(log._id, {
    $set: {
      status: nextStatus,
      providerMessageId: result.providerMessageId,
      cost: result.cost || 0,
      currency: result.currency || 'INR',
      sentAt: result.success ? new Date() : undefined,
      nextRetryAt: (!result.success && transient) ? new Date(Date.now() + _retryDelay(0)) : undefined,
    },
    $push: { attempts: attemptEntry },
  });

  // Fallback attempt
  if (!result.success && !transient) {
    const fallback = getFallbackProvider();
    if (fallback && fallback.name !== provider.name) {
      logger.warn({ messageId, fallbackProvider: fallback.name }, 'Primary provider failed; trying fallback');
      try {
        const fbResult = await fallback.send({ to: normalised, from: payload.from, message, unicode: payload.unicode, referenceId: messageId });
        if (fbResult.success) {
          await SmsLog.findByIdAndUpdate(log._id, {
            $set: {
              status: 'SENT',
              providerMessageId: fbResult.providerMessageId,
              provider: fallback.name,
              sentAt: new Date(),
            },
            $push: {
              attempts: {
                attemptNumber: 2,
                provider: fallback.name,
                status: 'SENT',
                timestamp: new Date(),
                rawResponse: fbResult.rawResponse,
              },
            },
          });
          result = fbResult;
        }
      } catch (fbErr) {
        logger.error({ messageId, err: fbErr.message }, 'Fallback provider also failed');
      }
    }
  }

  return SmsLog.findById(log._id).lean();
}

async function sendOtp(payload, tenantId) {
  const normalised = normalisePhone(payload.to);
  const otpLength = payload.otpLength || config.otp.length;
  const otp = _generateOtp(otpLength);
  const expiresAt = new Date(Date.now() + (payload.expiresInMinutes || config.otp.expiryMinutes) * 60 * 1000);
  const referenceId = payload.referenceId || uuidv4();

  let message;
  if (payload.templateId) {
    const tpl = await SmsTemplate.findById(payload.templateId).lean();
    if (!tpl) throw new AppError(`Template ${payload.templateId} not found`, 404);
    message = render(tpl.body, { otp, ...payload.variables });
  } else {
    message = `Your OTP is ${otp}. Valid for ${payload.expiresInMinutes || config.otp.expiryMinutes} minutes. Do not share.`;
  }

  // Store OTP before sending
  await OtpStore.findOneAndUpdate(
    { phone: normalised, tenantId },
    {
      otp,
      referenceId,
      expiresAt,
      verified: false,
      attempts: 0,
    },
    { upsert: true, new: true },
  );

  const smsResult = await sendSms(
    { to: normalised, message, messageType: 'OTP', referenceId, metadata: { otpSend: true } },
    tenantId,
  );

  // Never expose OTP in response
  return { messageId: smsResult.messageId, referenceId, expiresAt, status: smsResult.status };
}

async function verifyOtp(payload, tenantId) {
  const normalised = normalisePhone(payload.to);
  const record = await OtpStore.findOne({
    phone: normalised,
    tenantId,
    ...(payload.referenceId ? { referenceId: payload.referenceId } : {}),
  });

  if (!record) throw new AppError('OTP not found or already used', 400, 'SMS_OTP_NOT_FOUND');
  if (record.expiresAt < new Date()) {
    await OtpStore.deleteOne({ _id: record._id });
    throw new AppError('OTP has expired', 400, 'SMS_OTP_EXPIRED');
  }
  if (record.attempts >= (config.otp.maxAttempts || 5)) {
    await OtpStore.deleteOne({ _id: record._id });
    throw new AppError('Maximum OTP attempts exceeded', 429, 'SMS_OTP_MAX_ATTEMPTS');
  }

  if (record.otp !== payload.otp.toString()) {
    await OtpStore.findByIdAndUpdate(record._id, { $inc: { attempts: 1 } });
    throw new AppError('Invalid OTP', 400, 'SMS_OTP_INVALID');
  }

  // Mark and delete after successful verify
  await OtpStore.deleteOne({ _id: record._id });
  return { verified: true, phone: normalised };
}

async function getMessageById(messageId, tenantId) {
  const log = await SmsLog.findOne({ messageId, tenantId }).lean();
  if (!log) throw new AppError(`Message ${messageId} not found`, 404, 'SMS_NOT_FOUND');
  return log;
}

async function listMessages(filters, tenantId) {
  const {
    page = 1, limit = 20, status, from: fromDate, to: toDate, provider,
  } = filters;

  const query = { tenantId };
  if (status) query.status = status;
  if (provider) query.provider = provider;
  if (fromDate || toDate) {
    query.createdAt = {};
    if (fromDate) query.createdAt.$gte = new Date(fromDate);
    if (toDate) query.createdAt.$lte = new Date(toDate);
  }

  const skip = (page - 1) * limit;
  const [docs, total] = await Promise.all([
    SmsLog.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    SmsLog.countDocuments(query),
  ]);

  return {
    data: docs,
    pagination: { total, page, limit, pages: Math.ceil(total / limit) },
  };
}

async function purgeMessage(messageId, tenantId) {
  const log = await SmsLog.findOne({ messageId, tenantId });
  if (!log) throw new AppError(`Message ${messageId} not found`, 404, 'SMS_NOT_FOUND');
  log.to = 'REDACTED';
  log.message = 'GDPR_PURGED';
  log.metadata = {};
  log.attempts = [];
  log.status = 'PURGED';
  await log.save();
  return { purged: true, messageId };
}

function _isTransientError(result) {
  if (result.success) return false;
  const errStr = JSON.stringify(result.rawResponse || '').toUpperCase();
  for (const code of TRANSIENT_CODES) {
    if (errStr.includes(code)) return true;
  }
  return false;
}

module.exports = { sendSms, sendOtp, verifyOtp, getMessageById, listMessages, purgeMessage };
