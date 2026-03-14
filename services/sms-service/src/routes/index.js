'use strict';

const express = require('express');
const router = express.Router();

const smsRoutes = require('./sms.routes');
const templateRoutes = require('./template.routes');
const analyticsRoutes = require('./analytics.routes');
const webhookRoutes = require('./webhook.routes');
const { getConnectionStatus } = require('../config/database');
const config = require('../config');

router.get('/health', (req, res) => {
  const dbStatus = getConnectionStatus();
  const ok = dbStatus === 'connected';
  res.status(ok ? 200 : 503).json({
    status: ok ? 'ok' : 'degraded',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    version: require('../../package.json').version,
    provider: config.sms.provider,
    db: { status: dbStatus },
  });
});

router.use('/sms', smsRoutes);
router.use('/templates', templateRoutes);
router.use('/analytics', analyticsRoutes);
router.use('/webhooks', webhookRoutes);

module.exports = router;
