'use strict';

const express = require('express');
const router = express.Router();
const { query } = require('express-validator');

const ctrl = require('../controllers/analytics.controller');
const authMiddleware = require('../middleware/auth');
const validate = require('../middleware/validate');

router.use(authMiddleware);

const dateRangeRules = [
  query('from').optional().isISO8601().withMessage('from must be ISO 8601 date'),
  query('to').optional().isISO8601().withMessage('to must be ISO 8601 date'),
];

router.get('/summary', dateRangeRules, validate, ctrl.summary);
router.get('/provider-health', ctrl.providerHealth);
router.get('/campaigns', ctrl.listCampaignsHandler);
router.get('/campaigns/:campaignId', ctrl.getCampaignHandler);
router.get('/campaigns/:campaignId/stats', ctrl.campaignStats);

module.exports = router;
