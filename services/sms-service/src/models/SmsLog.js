'use strict';

const mongoose = require('mongoose');

const PROVIDERS = [
  'twilio','fast2sms','msg91','textlocal','2factor','exotel',
  'kaleyra','gupshup','routemobile','valuefirst',
  'jiocx','airteliq','plivo','vonage','awssns','sinch',
  'infobip','d7networks','telnyx','smscountry','smsgateway','mock',
];

const attemptSchema = new mongoose.Schema({
  attemptNumber: Number,
  provider: String,
  timestamp: { type: Date, default: Date.now },
  status: String,
  providerMessageId: String,
  rawResponse: mongoose.Schema.Types.Mixed,
  error: String,
  durationMs: Number,
}, { _id: false });

const statusHistorySchema = new mongoose.Schema({
  status: String,
  timestamp: { type: Date, default: Date.now },
  note: String,
}, { _id: false });

const smsLogSchema = new mongoose.Schema({
  // Identity
  messageId: { type: String, required: true, unique: true, index: true },
  providerMessageId: { type: String, index: true, sparse: true },

  // Routing
  provider: { type: String, enum: PROVIDERS, required: true, index: true },
  fallbackUsed: { type: Boolean, default: false },

  // Recipient
  to: { type: String, required: true, index: true },
  toCountryCode: String,
  from: String,

  // Content
  message: { type: String, required: true },
  templateId: { type: mongoose.Schema.Types.ObjectId, ref: 'SmsTemplate', index: true },
  templateVariables: mongoose.Schema.Types.Mixed,
  messageType: {
    type: String,
    enum: ['TRANSACTIONAL', 'PROMOTIONAL', 'OTP', 'FLASH'],
    default: 'TRANSACTIONAL',
    index: true,
  },
  unicode: { type: Boolean, default: false },
  messageLength: Number,
  segmentCount: Number,

  // Status
  status: {
    type: String,
    enum: ['QUEUED', 'SENDING', 'SENT', 'DELIVERED', 'FAILED', 'UNDELIVERED', 'REJECTED', 'UNKNOWN', 'RETRYING', 'PURGED'],
    default: 'QUEUED',
    index: true,
  },
  statusHistory: [statusHistorySchema],

  // Provider Response
  providerResponse: mongoose.Schema.Types.Mixed,
  providerError: mongoose.Schema.Types.Mixed,
  errorCode: String,
  errorMessage: String,

  // Retry
  attempts: [attemptSchema],
  retryCount: { type: Number, default: 0 },
  nextRetryAt: { type: Date, index: true, sparse: true },

  // Timing
  queuedAt: Date,
  sentAt: Date,
  deliveredAt: Date,
  durationMs: Number,

  // Cost
  cost: Number,
  currency: String,

  // DLR
  dlrReceived: { type: Boolean, default: false },
  dlrTimestamp: Date,
  dlrPayload: mongoose.Schema.Types.Mixed,

  // Context
  tenantId: { type: String, index: true },
  userId: String,
  campaignId: { type: mongoose.Schema.Types.ObjectId, ref: 'SmsCampaign', index: true, sparse: true },
  referenceId: { type: String, index: true, sparse: true },
  tags: { type: [String], index: true },
  metadata: mongoose.Schema.Types.Mixed,

  // Compliance
  isArchived: { type: Boolean, default: false },
  gdprPurge: { type: Boolean, default: false },
}, {
  timestamps: true,
  versionKey: false,
});

// Compound index for idempotency
smsLogSchema.index({ referenceId: 1, tenantId: 1 }, { unique: true, sparse: true });
// Index for retry worker
smsLogSchema.index({ status: 1, nextRetryAt: 1 });
// Index for analytics date range queries
smsLogSchema.index({ createdAt: 1, provider: 1, status: 1 });

const SmsLog = mongoose.model('SmsLog', smsLogSchema);
module.exports = SmsLog;
