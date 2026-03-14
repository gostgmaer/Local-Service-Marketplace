'use strict';

const SmsLog = require('../models/SmsLog');
const { getProvider } = require('../config/providers');
const logger = require('../utils/logger');
const config = require('../config');

const MAX_ATTEMPTS = config.sms.maxRetries || 3;
const RETRY_DELAYS = [30 * 1000, 2 * 60 * 1000, 10 * 60 * 1000];

function _nextDelay(attemptCount) {
  return RETRY_DELAYS[Math.min(attemptCount, RETRY_DELAYS.length - 1)];
}

/**
 * Process all SMS logs that are RETRYING and whose nextRetryAt has passed.
 * Called by a setInterval in index.js or a cron job.
 */
async function processRetries() {
  const now = new Date();
  const pending = await SmsLog.find({
    status: 'RETRYING',
    nextRetryAt: { $lte: now },
    $expr: { $lt: [{ $size: '$attempts' }, MAX_ATTEMPTS] },
  }).limit(100).lean();

  if (!pending.length) return;

  logger.info({ count: pending.length }, 'Processing retry queue');
  const provider = getProvider();

  for (const log of pending) {
    try {
      const result = await provider.send({
        to: log.to,
        from: log.from,
        message: log.message,
        unicode: log.unicode,
        referenceId: log.messageId,
        dltTemplateId: log.dltTemplateId,
        dltEntityId: log.dltEntityId,
        messageType: log.messageType,
      });

      const attemptsCount = log.attempts.length + 1;
      const isLastAttempt = attemptsCount >= MAX_ATTEMPTS;
      const newStatus = result.success
        ? 'SENT'
        : (isLastAttempt ? 'FAILED' : 'RETRYING');

      await SmsLog.findByIdAndUpdate(log._id, {
        $set: {
          status: newStatus,
          providerMessageId: result.success ? result.providerMessageId : log.providerMessageId,
          sentAt: result.success ? new Date() : undefined,
          nextRetryAt: (!result.success && !isLastAttempt)
            ? new Date(Date.now() + _nextDelay(attemptsCount))
            : undefined,
        },
        $push: {
          attempts: {
            attemptNumber: attemptsCount,
            provider: config.sms.provider,
            status: result.success ? 'SENT' : 'FAILED',
            error: result.success ? undefined : (result.rawResponse?.error || 'Provider error'),
            timestamp: new Date(),
            rawResponse: result.rawResponse,
          },
        },
      });

      logger.info({ messageId: log.messageId, attempt: attemptsCount, success: result.success }, 'Retry attempt completed');
    } catch (err) {
      logger.error({ messageId: log.messageId, err: err.message }, 'Retry attempt threw exception');
    }
  }
}

/**
 * Start the retry worker. Returns a handle to stop it.
 */
function startRetryWorker(intervalMs = 60 * 1000) {
  const handle = setInterval(() => {
    processRetries().catch((err) => logger.error({ err: err.message }, 'Retry worker error'));
  }, intervalMs);
  handle.unref(); // Don't prevent process exit
  logger.info({ intervalMs }, 'Retry worker started');
  return handle;
}

function stopRetryWorker(handle) {
  if (handle) clearInterval(handle);
}

module.exports = { processRetries, startRetryWorker, stopRetryWorker };
