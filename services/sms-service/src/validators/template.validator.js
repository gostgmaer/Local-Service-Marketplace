'use strict';

const { body, param } = require('express-validator');

const MSG_TYPE = ['TRANSACTIONAL', 'PROMOTIONAL', 'OTP', 'FLASH'];

const createTemplateRules = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Template name is required')
    .isLength({ min: 2, max: 100 })
    .withMessage('Name must be 2-100 characters')
    .matches(/^[a-zA-Z0-9_-]+$/)
    .withMessage('Name may only contain letters, numbers, underscores, hyphens'),
  body('body')
    .trim()
    .notEmpty()
    .withMessage('Template body is required')
    .isLength({ max: 1600 })
    .withMessage('Body must not exceed 1600 characters'),
  body('messageType')
    .optional()
    .isIn(MSG_TYPE)
    .withMessage(`messageType must be one of: ${MSG_TYPE.join(', ')}`),
  body('dltTemplateId')
    .optional()
    .trim()
    .isLength({ max: 50 }),
  body('dltEntityId')
    .optional()
    .trim()
    .isLength({ max: 50 }),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 }),
];

const updateTemplateRules = [
  param('templateId')
    .isMongoId()
    .withMessage('templateId must be a valid ObjectId'),
  ...createTemplateRules.map((rule) => {
    // Make all body validators optional for PATCH
    const opt = rule.optional ? rule.optional() : rule;
    return opt;
  }),
];

const getTemplateRules = [
  param('templateId')
    .isMongoId()
    .withMessage('templateId must be a valid ObjectId'),
];

module.exports = {
  createTemplateRules,
  updateTemplateRules,
  getTemplateRules,
};
