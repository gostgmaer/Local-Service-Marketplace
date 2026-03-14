'use strict';

const config = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '5000', 10),
  serviceName: process.env.SERVICE_NAME || 'sms-delivery-service',
  apiVersion: process.env.API_VERSION || 'v1',

  db: {
    uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/sms_delivery_service',
    poolSize: parseInt(process.env.MONGODB_POOL_SIZE || '10', 10),
    timeoutMs: parseInt(process.env.MONGODB_TIMEOUT_MS || '5000', 10),
  },

  auth: {
    apiKey: process.env.API_KEY || '',
    jwtSecret: process.env.JWT_SECRET || '',
  },

  // Tenant configuration.
  // TENANCY_ENABLED=true  → x-tenant-id is enforced (or DEFAULT_TENANT_ID fallback).
  // TENANCY_ENABLED=false → tenant is optional; service works without tenant scoping.
  tenant: {
    enabled: process.env.TENANCY_ENABLED === 'true',
    defaultTenantId: process.env.DEFAULT_TENANT_ID ? process.env.DEFAULT_TENANT_ID.trim() : null,
  },

  sms: {
    provider: process.env.SMS_PROVIDER || 'mock',
    fallback: process.env.SMS_PROVIDER_FALLBACK || '',
    maxRetries: parseInt(process.env.SMS_MAX_RETRIES || '3', 10),
    retryDelayMs: parseInt(process.env.SMS_RETRY_DELAY_MS || '30000', 10),
    retryBackoffMultiplier: parseInt(process.env.SMS_RETRY_BACKOFF_MULTIPLIER || '4', 10),
  },

  otp: {
    length: parseInt(process.env.OTP_LENGTH || '6', 10),
    expiryMinutes: parseInt(process.env.OTP_EXPIRY_MINUTES || '10', 10),
    maxAttempts: parseInt(process.env.OTP_MAX_ATTEMPTS || '3', 10),
  },

  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10),
    maxGlobal: parseInt(process.env.RATE_LIMIT_MAX_GLOBAL || '1000', 10),
    maxPerTenant: parseInt(process.env.RATE_LIMIT_PER_TENANT || '100', 10),
    redisUrl: process.env.REDIS_URL || '',
  },

  logging: {
    level: process.env.LOG_LEVEL || 'info',
    format: process.env.LOG_FORMAT || 'json',
    filePath: process.env.LOG_FILE_PATH || './logs/sms-service.log',
  },

  webhookBaseUrl: process.env.WEBHOOK_BASE_URL || '',

  // Provider credentials
  providers: {
    mock: {
      successRate: parseFloat(process.env.MOCK_SUCCESS_RATE || '0.95'),
      dlrDelayMs: parseInt(process.env.MOCK_DLR_DELAY_MS || '2000', 10),
    },
    fast2sms: {
      apiKey: process.env.FAST2SMS_API_KEY || '',
      senderId: process.env.FAST2SMS_SENDER_ID || 'FSTSMS',
      route: process.env.FAST2SMS_ROUTE || 'q',
      dltEntityId: process.env.FAST2SMS_DLT_ENTITY_ID || '',
    },
    twofactor: {
      apiKey: process.env.TWOFACTOR_API_KEY || '',
      senderId: process.env.TWOFACTOR_SENDER_ID || '',
      otpTemplate: process.env.TWOFACTOR_OTP_TEMPLATE || '',
    },
    smsgateway: {
      email: process.env.SMSGATEWAY_EMAIL || '',
      password: process.env.SMSGATEWAY_PASSWORD || '',
      deviceId: process.env.SMSGATEWAY_DEVICE_ID || '',
    },
    infobip: {
      baseUrl: process.env.INFOBIP_BASE_URL || '',
      apiKey: process.env.INFOBIP_API_KEY || '',
      sender: process.env.INFOBIP_SENDER || 'InfoSMS',
    },
    telnyx: {
      apiKey: process.env.TELNYX_API_KEY || '',
      fromNumber: process.env.TELNYX_FROM_NUMBER || '',
      messagingProfileId: process.env.TELNYX_MESSAGING_PROFILE_ID || '',
    },
    vonage: {
      apiKey: process.env.VONAGE_API_KEY || '',
      apiSecret: process.env.VONAGE_API_SECRET || '',
      from: process.env.VONAGE_FROM || 'VONAGE',
    },
    msg91: {
      authKey: process.env.MSG91_AUTH_KEY || '',
      senderId: process.env.MSG91_SENDER_ID || '',
      route: process.env.MSG91_ROUTE || '4',
      dltTeId: process.env.MSG91_DLT_TE_ID || '',
    },
    d7networks: {
      apiToken: process.env.D7_API_TOKEN || '',
      senderId: process.env.D7_SENDER_ID || 'D7TEST',
    },
    sinch: {
      servicePlanId: process.env.SINCH_SERVICE_PLAN_ID || '',
      apiToken: process.env.SINCH_API_TOKEN || '',
      fromNumber: process.env.SINCH_FROM_NUMBER || '',
      region: process.env.SINCH_REGION || 'us',
    },
    textlocal: {
      apiKey: process.env.TEXTLOCAL_API_KEY || '',
      sender: process.env.TEXTLOCAL_SENDER || 'TXTLCL',
    },
    gupshup: {
      userId: process.env.GUPSHUP_USERID || '',
      password: process.env.GUPSHUP_PASSWORD || '',
      msgType: process.env.GUPSHUP_MSG_TYPE || 'TEXT',
      sendMethod: process.env.GUPSHUP_SEND_METHOD || 'simpleMessage',
    },
    plivo: {
      authId: process.env.PLIVO_AUTH_ID || '',
      authToken: process.env.PLIVO_AUTH_TOKEN || '',
      fromNumber: process.env.PLIVO_FROM_NUMBER || '',
    },
    twilio: {
      accountSid: process.env.TWILIO_ACCOUNT_SID || '',
      authToken: process.env.TWILIO_AUTH_TOKEN || '',
      fromNumber: process.env.TWILIO_FROM_NUMBER || '',
    },
    awssns: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
      region: process.env.AWS_REGION || 'ap-south-1',
      senderId: process.env.AWS_SNS_SENDER_ID || '',
      smsType: process.env.AWS_SNS_SMS_TYPE || 'Transactional',
    },
    kaleyra: {
      apiKey: process.env.KALEYRA_API_KEY || '',
      sid: process.env.KALEYRA_SID || '',
      sender: process.env.KALEYRA_SENDER || '',
    },
    airteliq: {
      clientId: process.env.AIRTELIQ_CLIENT_ID || '',
      clientSecret: process.env.AIRTELIQ_CLIENT_SECRET || '',
      senderId: process.env.AIRTELIQ_SENDER_ID || '',
      peid: process.env.AIRTELIQ_PEID || '',
    },
    jiocx: {
      apiKey: process.env.JIOCX_API_KEY || '',
      accountId: process.env.JIOCX_ACCOUNT_ID || '',
      senderId: process.env.JIOCX_SENDER_ID || '',
    },
    exotel: {
      apiKey: process.env.EXOTEL_API_KEY || '',
      apiToken: process.env.EXOTEL_API_TOKEN || '',
      sid: process.env.EXOTEL_SID || '',
      senderId: process.env.EXOTEL_SENDER_ID || '',
    },
    routemobile: {
      username: process.env.ROUTEMOBILE_USERNAME || '',
      password: process.env.ROUTEMOBILE_PASSWORD || '',
      source: process.env.ROUTEMOBILE_SOURCE || '',
    },
    valuefirst: {
      username: process.env.VALUEFIRST_USERNAME || '',
      password: process.env.VALUEFIRST_PASSWORD || '',
      sender: process.env.VALUEFIRST_SENDER || '',
    },
    smscountry: {
      username: process.env.SMSCOUNTRY_USERNAME || '',
      password: process.env.SMSCOUNTRY_PASSWORD || '',
      senderId: process.env.SMSCOUNTRY_SENDER_ID || '',
    },
  },
};

module.exports = config;
