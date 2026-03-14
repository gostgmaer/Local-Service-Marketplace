'use strict';

const express = require('express');
const router = express.Router();
const wh = require('../controllers/webhook.controller');

// Webhook routes are NOT protected by API key auth.
// Each handler validates the provider-specific HMAC/signature internally.

router.post('/twilio', wh.twilio);
router.post('/vonage', wh.vonage);
router.post('/msg91', wh.msg91);
router.post('/fast2sms', wh.fast2sms);
router.post('/textlocal', wh.textlocal);
router.post('/gupshup', wh.gupshup);
router.post('/kaleyra', wh.kaleyra);
router.post('/exotel', wh.exotel);
router.post('/smsgateway', wh.msgGateway);
router.post('/infobip', wh.infobip);
router.post('/telnyx', wh.telnyx);
router.post('/sinch', wh.sinch);
router.post('/plivo', wh.plivo);
router.post('/d7networks', wh.d7networks);
router.post('/jiocx', wh.jiocx);
router.post('/airteliq', wh.airteliq);
router.post('/routemobile', wh.routemobile);
router.post('/valuefirst', wh.valuefirst);
router.post('/smscountry', wh.smscountry);

module.exports = router;
