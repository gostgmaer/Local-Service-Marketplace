/**
 * Jest setup file — sets required environment variables before any test module
 * is loaded so that services.config.ts (which calls required() at module scope)
 * does not throw during unit test runs.
 */
process.env.IDENTITY_SERVICE_URL = process.env.IDENTITY_SERVICE_URL || "http://localhost:3001";
process.env.MARKETPLACE_SERVICE_URL = process.env.MARKETPLACE_SERVICE_URL || "http://localhost:3003";
process.env.PAYMENT_SERVICE_URL = process.env.PAYMENT_SERVICE_URL || "http://localhost:3006";
process.env.COMMS_SERVICE_URL = process.env.COMMS_SERVICE_URL || "http://localhost:3007";
process.env.OVERSIGHT_SERVICE_URL = process.env.OVERSIGHT_SERVICE_URL || "http://localhost:3010";
process.env.INFRASTRUCTURE_SERVICE_URL = process.env.INFRASTRUCTURE_SERVICE_URL || "http://localhost:3012";
process.env.FILE_UPLOAD_SERVICE_URL = process.env.FILE_UPLOAD_SERVICE_URL || "http://localhost:4100";
process.env.GATEWAY_INTERNAL_SECRET = process.env.GATEWAY_INTERNAL_SECRET || "test-gateway-secret";
