'use strict';

const SmsLog = require('../models/SmsLog');
const SmsCampaign = require('../models/SmsCampaign');

async function getSummary(tenantId, { from, to } = {}) {
  const matchStage = { tenantId };
  if (from || to) {
    matchStage.createdAt = {};
    if (from) matchStage.createdAt.$gte = new Date(from);
    if (to) matchStage.createdAt.$lte = new Date(to);
  }

  const [summary, byProvider, byStatus] = await Promise.all([
    SmsLog.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          sent: { $sum: { $cond: [{ $eq: ['$status', 'SENT'] }, 1, 0] } },
          delivered: { $sum: { $cond: [{ $eq: ['$status', 'DELIVERED'] }, 1, 0] } },
          failed: { $sum: { $cond: [{ $eq: ['$status', 'FAILED'] }, 1, 0] } },
          queued: { $sum: { $cond: [{ $eq: ['$status', 'QUEUED'] }, 1, 0] } },
          retrying: { $sum: { $cond: [{ $eq: ['$status', 'RETRYING'] }, 1, 0] } },
          totalCost: { $sum: '$cost' },
          totalSegments: { $sum: '$segmentCount' },
        },
      },
    ]),
    SmsLog.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: '$provider',
          total: { $sum: 1 },
          sent: { $sum: { $cond: [{ $eq: ['$status', 'SENT'] }, 1, 0] } },
          delivered: { $sum: { $cond: [{ $eq: ['$status', 'DELIVERED'] }, 1, 0] } },
          failed: { $sum: { $cond: [{ $eq: ['$status', 'FAILED'] }, 1, 0] } },
          totalCost: { $sum: '$cost' },
        },
      },
    ]),
    SmsLog.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
        },
      },
    ]),
  ]);

  return {
    summary: summary[0] || { total: 0, sent: 0, delivered: 0, failed: 0, queued: 0, retrying: 0, totalCost: 0 },
    byProvider,
    byStatus,
  };
}

async function getProviderHealth(tenantId) {
  const pipeline = [
    {
      $match: {
        tenantId,
        createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      },
    },
    {
      $group: {
        _id: '$provider',
        total: { $sum: 1 },
        failed: { $sum: { $cond: [{ $eq: ['$status', 'FAILED'] }, 1, 0] } },
        sent: { $sum: { $cond: [{ $in: ['$status', ['SENT', 'DELIVERED']] }, 1, 0] } },
      },
    },
    {
      $project: {
        provider: '$_id',
        total: 1,
        failed: 1,
        sent: 1,
        successRate: {
          $cond: [
            { $gt: ['$total', 0] },
            { $multiply: [{ $divide: ['$sent', '$total'] }, 100] },
            0,
          ],
        },
      },
    },
  ];

  return SmsLog.aggregate(pipeline);
}

async function getCampaignStats(campaignId, tenantId) {
  const [campaign, logStats] = await Promise.all([
    SmsCampaign.findOne({ campaignId, tenantId }).lean(),
    SmsLog.aggregate([
      { $match: { tenantId, 'metadata.campaignId': campaignId } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
        },
      },
    ]),
  ]);

  return { campaign, statusBreakdown: logStats };
}

module.exports = { getSummary, getProviderHealth, getCampaignStats };
