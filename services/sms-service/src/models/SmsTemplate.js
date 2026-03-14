'use strict';

const mongoose = require('mongoose');

const smsTemplateSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true, trim: true },
  body: { type: String, required: true },
  messageType: {
    type: String,
    enum: ['transactional', 'promotional', 'otp'],
    default: 'transactional',
  },
  dltTemplateId: { type: String },   // TRAI DLT template ID
  dltEntityId: { type: String },     // TRAI DLT principal entity ID
  senderId: String,
  provider: String,
  tenantId: { type: String, index: true },
  isActive: { type: Boolean, default: true },
  isDeleted: { type: Boolean, default: false },
  deletedAt:  { type: Date, default: null },
  deletedBy:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  variables: [String],               // e.g. ['name', 'otp']
}, {
  timestamps: true,
  versionKey: false,
});

smsTemplateSchema.index({ name: 1, tenantId: 1 });

const SmsTemplate = mongoose.model('SmsTemplate', smsTemplateSchema);
module.exports = SmsTemplate;
