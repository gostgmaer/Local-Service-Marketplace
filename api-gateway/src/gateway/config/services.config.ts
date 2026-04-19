import * as dotenv from "dotenv";
dotenv.config();

export interface ServiceConfig {
  url: string;
  name: string;
  stripPrefix?: string;
}

const required = (key: string): string => {
  const value = process.env[key];
  if (!value) throw new Error(`Missing required environment variable: ${key}`);
  return value;
};

export const servicesConfig: Record<string, ServiceConfig> = {
  "identity-service": {
    url: required("IDENTITY_SERVICE_URL"),
    name: "identity-service",
  },
  "identity-service-auth": {
    url: required("IDENTITY_SERVICE_URL"),
    name: "identity-service",
    stripPrefix: "/user",
  },
  "identity-service-rbac": {
    url: required("IDENTITY_SERVICE_URL"),
    name: "identity-service",
    stripPrefix: "/identity",
  },
  "marketplace-service": {
    url: required("MARKETPLACE_SERVICE_URL"),
    name: "marketplace-service",
  },
  "payment-service": {
    url: required("PAYMENT_SERVICE_URL"),
    name: "payment-service",
  },
  "comms-service": {
    url: required("COMMS_SERVICE_URL"),
    name: "comms-service",
  },
  "oversight-service": {
    url: required("OVERSIGHT_SERVICE_URL"),
    name: "oversight-service",
  },
  "infrastructure-service": {
    url: process.env.INFRASTRUCTURE_SERVICE_URL ?? "",
    name: "infrastructure-service",
  },
  "file-upload-service": {
    url: `${required("FILE_UPLOAD_SERVICE_URL")}/api`,
    name: "file-upload-service",
  },
};

export const routingConfig = {
  // identity-service (auth + user + providers + rbac)
  "/identity": "identity-service-rbac",
  "/user/auth": "identity-service-auth",
  "/users": "identity-service",
  "/providers": "identity-service",
  "/provider-documents": "identity-service",
  "/provider-portfolio": "identity-service",
  "/favorites": "identity-service",
  "/roles": "identity-service",
  "/permissions": "identity-service",
  // marketplace-service (requests + proposals + jobs + reviews)
  "/requests": "marketplace-service",
  "/categories": "marketplace-service",
  "/proposals": "marketplace-service",
  "/jobs": "marketplace-service",
  "/reviews": "marketplace-service",
  "/review-aggregates": "marketplace-service",
  // payment-service
  "/payments": "payment-service",
  "/refunds": "payment-service",
  "/coupons": "payment-service",
  "/payment-methods": "payment-service",
  "/subscriptions": "payment-service",
  "/pricing-plans": "payment-service",
  "/webhooks": "payment-service",
  // comms-service (messaging + notifications)
  "/messages": "comms-service",
  "/notifications": "comms-service",
  "/notification-preferences": "comms-service",
  "/devices": "comms-service",
  // oversight-service (admin + analytics + user disputes + public config)
  "/admin": "oversight-service",
  "/analytics": "oversight-service",
  "/disputes": "oversight-service",
  "/public": "oversight-service",
  // infrastructure-service
  "/events": "infrastructure-service",
  "/background-jobs": "infrastructure-service",
  "/rate-limits": "infrastructure-service",
  "/feature-flags": "infrastructure-service",
  "/dlq": "infrastructure-service",
  // file-upload-service
  "/files": "file-upload-service",
};

/**
 * API Gateway Route Configuration
 *
 * PUBLIC ROUTES: No authentication required (all HTTP methods)
 * PUBLIC GET ROUTES: Only GET requests allowed without auth (POST/PATCH/DELETE require JWT)
 * PROTECTED ROUTES: All other routes require JWT authentication
 */

// ============================================
// PUBLIC ROUTES (All HTTP Methods Allowed)
// ============================================
export const publicRoutes = [
  // ============================================
  // Authentication Endpoints
  // ============================================
  "/api/v1/user/auth/signup", // Create account
  "/api/v1/user/auth/login", // Email + password login
  "/api/v1/user/auth/refresh", // Refresh JWT token
  "/api/v1/user/auth/password-reset/request", // Request password reset
  "/api/v1/user/auth/password-reset/confirm", // Confirm password reset
  "/api/v1/user/auth/email/verify", // Verify email address
  "/api/v1/user/auth/check-identifier", // Check if email/phone exists
  "/api/v1/user/auth/verify", // Internal token verification (gateway only)

  // ============================================
  // OAuth Endpoints
  // ============================================
  "/api/v1/user/auth/google", // Google OAuth initiate
  "/api/v1/user/auth/google/callback", // Google OAuth callback
  "/api/v1/user/auth/facebook", // Facebook OAuth initiate
  "/api/v1/user/auth/facebook/callback", // Facebook OAuth callback
  "/api/v1/user/auth/oauth/exchange", // Exchange one-time OAuth code for tokens

  // ============================================
  // Phone Authentication Endpoints
  // ============================================
  "/api/v1/user/auth/phone/login", // Phone + password login
  "/api/v1/user/auth/phone/otp/request", // Request OTP via SMS
  "/api/v1/user/auth/phone/otp/verify", // Verify OTP code

  // ============================================
  // Email OTP Endpoints (if implemented)
  // ============================================
  "/api/v1/user/auth/email/otp/request", // Request OTP via email
  "/api/v1/user/auth/email/otp/verify", // Verify email OTP

  // ============================================
  // Payment Webhooks (external services — no JWT)
  // ============================================
  "/api/v1/webhooks/", // All payment gateway webhooks: /webhooks/:gateway

  // ============================================
  // Public Information Endpoints
  // ============================================
  "/api/v1/admin/contact", // Contact form submission (public POST)
  "/api/v1/review-aggregates/provider/", // View provider review aggregates (public)

  // ============================================
  // Public Configuration Endpoints
  // ============================================
  "/api/v1/public/", // All public oversight endpoints (site-config, maintenance-status, etc.)

  // ============================================
  // Health & Monitoring
  // ============================================
  "/api/v1/health", // API Gateway health check
  "/api/v1/health/services", // All services health status
  "/health", // Health (without /api/v1 prefix)
  "/health/services", // Services health (without /api/v1 prefix)
];

// ============================================
// PUBLIC GET-ONLY ROUTES
// ============================================
// These routes allow GET requests without authentication
// POST/PATCH/PUT/DELETE require JWT token
export const publicGetRoutes = [
  // ============================================
  // Service Requests (Public Marketplace Browsing)
  // ============================================
  "/api/v1/requests", // Browse all service requests (GET only)
  "/api/v1/requests/", // View individual request details (GET /requests/:id)

  // ============================================
  // Service Categories (Public Browsing)
  // ============================================
  "/api/v1/categories", // List service categories (GET only)
  "/api/v1/categories/", // View individual category (GET /categories/:id)
  "/categories", // Same routes without /api/v1 prefix (used by API client directly)
  "/categories/", // View individual category without prefix

  // ============================================
  // Provider Directory (Public Browsing)
  // ============================================
  "/api/v1/providers", // Browse provider directory (GET only)
  "/api/v1/providers/", // View individual provider profiles (GET /providers/:id)

  // ============================================
  // Provider Reviews (Public Viewing)
  // ============================================
  "/api/v1/reviews", // Browse reviews (GET only)
  "/api/v1/providers/", // Includes /providers/:id/reviews

  // ============================================
  // Pricing Plans (Public Information)
  // ============================================
  "/api/v1/pricing-plans", // View pricing tiers (GET only)

  // ============================================
  // File Upload Service (Public Endpoints)
  // ============================================
  "/api/v1/files", // Browse files (GET only - public viewing)
  "/api/v1/files/", // View specific file (GET /files/:id, /files/:id/download)
];
