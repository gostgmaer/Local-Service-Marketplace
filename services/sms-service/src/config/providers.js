'use strict';

const config = require('./index');
const logger = require('../utils/logger');

const PROVIDER_MAP = {
  mock: () => require('../providers/mock.provider'),
  fast2sms: () => require('../providers/fast2sms.provider'),
  '2factor': () => require('../providers/2factor.provider'),
  smsgateway: () => require('../providers/smsgateway.provider'),
  infobip: () => require('../providers/infobip.provider'),
  telnyx: () => require('../providers/telnyx.provider'),
  vonage: () => require('../providers/vonage.provider'),
  msg91: () => require('../providers/msg91.provider'),
  d7networks: () => require('../providers/d7networks.provider'),
  sinch: () => require('../providers/sinch.provider'),
  textlocal: () => require('../providers/textlocal.provider'),
  gupshup: () => require('../providers/gupshup.provider'),
  plivo: () => require('../providers/plivo.provider'),
  twilio: () => require('../providers/twilio.provider'),
  awssns: () => require('../providers/awssns.provider'),
  kaleyra: () => require('../providers/kaleyra.provider'),
  airteliq: () => require('../providers/airteliq.provider'),
  jiocx: () => require('../providers/jiocx.provider'),
  exotel: () => require('../providers/exotel.provider'),
  routemobile: () => require('../providers/routemobile.provider'),
  valuefirst: () => require('../providers/valuefirst.provider'),
  smscountry: () => require('../providers/smscountry.provider'),
};

function createProvider(name) {
  // Force mock in test environment
  const providerName = process.env.NODE_ENV === 'test' ? 'mock' : (name || 'mock');
  const loader = PROVIDER_MAP[providerName];
  if (!loader) {
    throw new Error(`Unknown SMS provider: "${providerName}". Check SMS_PROVIDER env variable.`);
  }
  const ProviderClass = loader();
  const providerConfig = config.providers[providerName] || {};
  return new ProviderClass(providerConfig);
}

let _primaryProvider = null;
let _fallbackProvider = null;

function getProvider() {
  if (!_primaryProvider) {
    _primaryProvider = createProvider(config.sms.provider);
    logger.info(`SMS provider loaded: ${config.sms.provider}`);
  }
  return _primaryProvider;
}

function getFallbackProvider() {
  if (!config.sms.fallback) return null;
  if (!_fallbackProvider) {
    _fallbackProvider = createProvider(config.sms.fallback);
    logger.info(`SMS fallback provider loaded: ${config.sms.fallback}`);
  }
  return _fallbackProvider;
}

// Allow resetting for tests
function resetProviders() {
  _primaryProvider = null;
  _fallbackProvider = null;
}

module.exports = { getProvider, getFallbackProvider, createProvider, resetProviders, PROVIDER_MAP };
