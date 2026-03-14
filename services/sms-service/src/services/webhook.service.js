'use strict';

const SmsLog = require('../models/SmsLog');
const { createProvider } = require('../config/providers');
const logger = require('../utils/logger');

const STATUS_MAP = {
  // Normalised to our canonical statuses
  delivered: 'DELIVERED',
  delivery_success: 'DELIVERED',
  sent: 'SENT',
  failed: 'FAILED',
  undelivered: 'UNDELIVERED',
  rejected: 'FAILED',
  expired: 'UNDELIVERED',
};

/**
 * Process an inbound webhook delivery receipt from any provider.
 * @param {string} providerName  - e.g. 'twilio', 'fast2sms'
 * @param {object} raw           - raw request body
 * @param {string} signature     - value from provider signature header
 * @param {object} headers       - full request headers
 * @param {string} requestUrl    - full webhook URL (used by some providers for HMAC)
 */
async function processWebhook(providerName, raw, signature, headers, requestUrl) {
  const provider = createProvider(providerName);

  // Validate signature when provider supports it
  let sigValid = false;
  try {
    sigValid = await provider.validateWebhookSignature(raw, signature, { headers, url: requestUrl });
  } catch {
    sigValid = false;
  }
  if (!sigValid) {
    logger.warn({ providerName }, 'Webhook signature validation failed — ignoring');
    return { accepted: false, reason: 'INVALID_SIGNATURE' };
  }

  // Extract providerMessageId and status from raw payload (provider-specific format)
  const { providerMessageId, status: rawStatus, dlrCode, errorCode, deliveredAt } = _extractFields(providerName, raw);

  if (!providerMessageId) {
    logger.warn({ providerName, raw }, 'Webhook missing providerMessageId');
    return { accepted: false, reason: 'MISSING_MESSAGE_ID' };
  }

  const normStatus = STATUS_MAP[rawStatus?.toLowerCase()] || 'UNKNOWN';
  if (normStatus === 'UNKNOWN') {
    logger.warn({ providerName, rawStatus }, 'Unrecognised webhook status');
    return { accepted: true, updated: false };
  }

  const updated = await SmsLog.findOneAndUpdate(
    { providerMessageId },
    {
      $set: {
        status: normStatus,
        dlrReceived: true,
        dlrTimestamp: new Date(),
        dlrPayload: { code: dlrCode, description: rawStatus, errorCode },
        deliveredAt: normStatus === 'DELIVERED' ? (deliveredAt ? new Date(deliveredAt) : new Date()) : undefined,
      },
    },
    { new: true },
  );

  if (!updated) {
    logger.warn({ providerName, providerMessageId }, 'Webhook: no matching SmsLog found');
    return { accepted: true, updated: false };
  }

  logger.info({ messageId: updated.messageId, providerMessageId, status: normStatus }, 'DLR webhook processed');
  return { accepted: true, updated: true, messageId: updated.messageId };
}

function _extractFields(provider, raw) {
  switch (provider) {
    case 'twilio':
      return {
        providerMessageId: raw.MessageSid,
        status: raw.MessageStatus,
        dlrCode: raw.ErrorCode,
        errorCode: raw.ErrorCode,
      };
    case 'vonage':
      return {
        providerMessageId: raw['message-id'],
        status: raw.status,
        dlrCode: raw['err-code'],
        errorCode: raw['err-code'],
        deliveredAt: raw['message-timestamp'],
      };
    case 'msg91':
      return {
        providerMessageId: raw.requestId,
        status: raw.status,
        dlrCode: raw.desc,
        errorCode: raw.cause,
      };
    case 'fast2sms':
      return {
        providerMessageId: raw.requestId || raw.request_id,
        status: raw.status,
        dlrCode: raw.errorCode,
        errorCode: raw.errorCode,
      };
    case 'd7networks':
      return {
        providerMessageId: raw.messageId,
        status: raw.status,
        dlrCode: raw.statusCode,
        errorCode: raw.errorCode,
      };
    case 'sinch':
      return {
        providerMessageId: raw.batch_id || raw.message_id,
        status: raw.status?.code || raw.status,
        dlrCode: raw.status?.code,
        errorCode: raw.status?.description,
      };
    case 'plivo':
      return {
        providerMessageId: raw.MessageUUID,
        status: raw.Status,
        dlrCode: raw.ErrorCode,
        errorCode: raw.ErrorCode,
      };
    case 'infobip':
      return {
        providerMessageId: raw.results?.[0]?.messageId || raw.messageId,
        status: raw.results?.[0]?.status?.name || raw.status,
        dlrCode: raw.results?.[0]?.status?.id,
        errorCode: raw.results?.[0]?.error?.id,
        deliveredAt: raw.results?.[0]?.sentAt,
      };
    case 'telnyx':
      return {
        providerMessageId: raw.data?.payload?.id,
        status: raw.data?.payload?.to?.[0]?.status || raw.data?.payload?.type,
        dlrCode: raw.data?.payload?.errors?.[0]?.code,
        errorCode: raw.data?.payload?.errors?.[0]?.title,
      };
    default:
      // Generic fallback
      return {
        providerMessageId: raw.messageId || raw.message_id || raw.msgid,
        status: raw.status || raw.deliveryStatus,
        dlrCode: raw.errorCode || raw.error_code,
        errorCode: raw.errorCode,
        deliveredAt: raw.deliveredAt || raw.delivered_at,
      };
  }
}

module.exports = { processWebhook };
