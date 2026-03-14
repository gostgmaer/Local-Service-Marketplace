'use strict';

const { v4: uuidv4 } = require('uuid');
const { EventEmitter } = require('events');
const SmsCampaign = require('../models/SmsCampaign');
const SmsLog = require('../models/SmsLog');
const SmsTemplate = require('../models/SmsTemplate');
const { sendSms } = require('./sms.service');
const { normalisePhone } = require('../utils/phoneNormalizer');
const { render } = require('../utils/templateEngine');
const { AppError } = require('../utils/errorHandler');
const logger = require('../utils/logger');
const config = require('../config');

const DEFAULT_BATCH = 50;

class BulkProgressEmitter extends EventEmitter {}
const bulkProgress = new BulkProgressEmitter();

async function sendBulk(payload, tenantId) {
  const {
    recipients,
    message: sharedMessage,
    templateId,
    from,
    messageType = 'PROMOTIONAL',
    batchSize = DEFAULT_BATCH,
    dltTemplateId,
    dltEntityId,
  } = payload;

  let template = null;
  if (templateId) {
    template = await SmsTemplate.findById(templateId).lean();
    if (!template) throw new AppError(`Template ${templateId} not found`, 404);
  }

  const campaignId = uuidv4();
  const campaign = await SmsCampaign.create({
    campaignId,
    tenantId,
    name: payload.name || `Campaign_${campaignId.slice(0, 8)}`,
    totalCount: recipients.length,
    sentCount: 0,
    deliveredCount: 0,
    failedCount: 0,
    status: 'RUNNING',
    provider: config.sms.activeProvider,
  });

  // Process in batches asynchronously — return campaign immediately
  _processBatches(campaign, recipients, { template, sharedMessage, from, messageType, dltTemplateId, dltEntityId, batchSize }, tenantId)
    .catch((err) => {
      logger.error({ campaignId, err: err.message }, 'Bulk campaign processing error');
      SmsCampaign.findByIdAndUpdate(campaign._id, { $set: { status: 'FAILED' } }).catch(() => {});
    });

  return { campaignId, totalCount: recipients.length, status: 'RUNNING' };
}

async function _processBatches(campaign, recipients, opts, tenantId) {
  const { template, sharedMessage, from, messageType, dltTemplateId, dltEntityId, batchSize } = opts;

  for (let i = 0; i < recipients.length; i += batchSize) {
    const batch = recipients.slice(i, i + batchSize);
    const results = await Promise.allSettled(
      batch.map(async (r) => {
        const phone = normalisePhone(r.to);
        const msg = template
          ? render(template.body, { ...(r.variables || {}) })
          : (r.message || sharedMessage);
        if (!msg) throw new Error(`No message for recipient ${r.to}`);
        return sendSms({ to: phone, message: msg, from, messageType, dltTemplateId, dltEntityId }, tenantId);
      }),
    );

    let sentInc = 0;
    let failedInc = 0;
    results.forEach((r) => {
      if (r.status === 'fulfilled' && r.value?.status === 'SENT') sentInc++;
      else failedInc++;
    });

    await SmsCampaign.findByIdAndUpdate(campaign._id, {
      $inc: { sentCount: sentInc, failedCount: failedInc },
    });

    bulkProgress.emit('batch', { campaignId: campaign.campaignId, processed: i + batch.length, total: recipients.length });
  }

  await SmsCampaign.findByIdAndUpdate(campaign._id, { $set: { status: 'COMPLETED', completedAt: new Date() } });
  bulkProgress.emit('done', { campaignId: campaign.campaignId });
}

async function getCampaign(campaignId, tenantId) {
  const c = await SmsCampaign.findOne({ campaignId, tenantId }).lean();
  if (!c) throw new AppError(`Campaign ${campaignId} not found`, 404);
  return c;
}

async function listCampaigns(filters, tenantId) {
  const { page = 1, limit = 20 } = filters;
  const skip = (page - 1) * limit;
  const [docs, total] = await Promise.all([
    SmsCampaign.find({ tenantId }).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    SmsCampaign.countDocuments({ tenantId }),
  ]);
  return { data: docs, pagination: { total, page, limit, pages: Math.ceil(total / limit) } };
}

module.exports = { sendBulk, getCampaign, listCampaigns, bulkProgress };
