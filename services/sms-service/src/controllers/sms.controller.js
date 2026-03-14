'use strict';

const { sendSms, sendOtp, verifyOtp, getMessageById, listMessages, purgeMessage } = require('../services/sms.service');
const { sendBulk } = require('../services/bulk.service');

async function send(req, res, next) {
  try {
    const result = await sendSms(req.body, req.tenantId);
    res.status(202).json({ success: true, data: result });
  } catch (err) { next(err); }
}

async function sendBulkSms(req, res, next) {
  try {
    const result = await sendBulk(req.body, req.tenantId);
    res.status(202).json({ success: true, data: result });
  } catch (err) { next(err); }
}

async function sendOtpHandler(req, res, next) {
  try {
    const result = await sendOtp(req.body, req.tenantId);
    res.status(202).json({ success: true, data: result });
  } catch (err) { next(err); }
}

async function verifyOtpHandler(req, res, next) {
  try {
    const result = await verifyOtp(req.body, req.tenantId);
    res.status(200).json({ success: true, data: result });
  } catch (err) { next(err); }
}

async function getById(req, res, next) {
  try {
    const log = await getMessageById(req.params.messageId, req.tenantId);
    res.status(200).json({ success: true, data: log });
  } catch (err) { next(err); }
}

async function list(req, res, next) {
  try {
    const result = await listMessages(req.query, req.tenantId);
    res.status(200).json({ success: true, ...result });
  } catch (err) { next(err); }
}

async function gdprPurge(req, res, next) {
  try {
    const result = await purgeMessage(req.params.messageId, req.tenantId);
    res.status(200).json({ success: true, data: result });
  } catch (err) { next(err); }
}

module.exports = { send, sendBulkSms, sendOtpHandler, verifyOtpHandler, getById, list, gdprPurge };
