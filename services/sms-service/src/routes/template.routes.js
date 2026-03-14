'use strict';

const express = require('express');
const router = express.Router();

const ctrl = require('../controllers/template.controller');
const authMiddleware = require('../middleware/auth');
const validate = require('../middleware/validate');
const { createTemplateRules, updateTemplateRules, getTemplateRules } = require('../validators/template.validator');

router.use(authMiddleware);

router.get('/', ctrl.list);
router.post('/', createTemplateRules, validate, ctrl.create);
router.get('/:templateId', getTemplateRules, validate, ctrl.getById);
router.put('/:templateId', updateTemplateRules, validate, ctrl.update);
router.delete('/:templateId', getTemplateRules, validate, ctrl.remove);

module.exports = router;
