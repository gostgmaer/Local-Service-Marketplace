'use strict';

const analyticsService = require('../services/analytics.service');
const { getCampaign, listCampaigns } = require('../services/bulk.service');

async function summary(req, res, next) {
  try {
    const { from, to } = req.query;
    const data = await analyticsService.getSummary(req.tenantId, { from, to });
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

async function providerHealth(req, res, next) {
  try {
    const data = await analyticsService.getProviderHealth(req.tenantId);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

async function campaignStats(req, res, next) {
  try {
    const data = await analyticsService.getCampaignStats(req.params.campaignId, req.tenantId);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

async function getCampaignHandler(req, res, next) {
  try {
    const data = await getCampaign(req.params.campaignId, req.tenantId);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

async function listCampaignsHandler(req, res, next) {
  try {
    const data = await listCampaigns(req.query, req.tenantId);
    res.json({ success: true, ...data });
  } catch (err) { next(err); }
}

module.exports = { summary, providerHealth, campaignStats, getCampaignHandler, listCampaignsHandler };
