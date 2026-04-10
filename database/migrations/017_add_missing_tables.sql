-- =============================================================================
-- Migration 017: Add missing feature tables
-- Date: 2026-04-10
-- Description: Creates tables that exist in schema.sql but had no migration file,
--              meaning they are missing on any database that was initialized via
--              migrations rather than a fresh schema.sql apply.
--
-- Tables added:
--   provider_documents         (identity-service — document verification)
--   provider_portfolio         (identity-service — portfolio images)
--   notification_preferences   (comms-service — per-user notification settings)
--   pricing_plans              (payment-service — subscription plan catalogue)
--   saved_payment_methods      (payment-service — stored card/bank details)
--   subscriptions              (payment-service — provider plan subscriptions)
--
-- Note: unsubscribes already created in migration 006.
-- Note: Uses CREATE TABLE IF NOT EXISTS throughout — safe to re-run.
-- =============================================================================

BEGIN;

-- =============================================================================
-- NOTIFICATION_DELIVERIES: add missing created_at column
-- =============================================================================

ALTER TABLE notification_deliveries
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT now() NOT NULL;

CREATE INDEX IF NOT EXISTS idx_notification_deliveries_created_at
  ON notification_deliveries(created_at ASC);

-- =============================================================================
-- PROVIDER DOCUMENTS
-- =============================================================================

CREATE TABLE IF NOT EXISTS provider_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  provider_id UUID NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL CHECK (document_type IN (
    'government_id', 'business_license', 'insurance_certificate',
    'certification', 'tax_document'
  )),
  document_url TEXT NOT NULL,
  document_name TEXT NOT NULL,
  document_number TEXT,
  verified BOOLEAN DEFAULT false,
  rejected BOOLEAN DEFAULT false,
  rejection_reason TEXT,
  verified_by UUID REFERENCES users(id),
  verified_at TIMESTAMP,
  expires_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_provider_documents_provider_id ON provider_documents(provider_id);
CREATE INDEX IF NOT EXISTS idx_provider_documents_type       ON provider_documents(document_type);
CREATE INDEX IF NOT EXISTS idx_provider_documents_verified   ON provider_documents(verified);

-- =============================================================================
-- PROVIDER PORTFOLIO
-- =============================================================================

CREATE TABLE IF NOT EXISTS provider_portfolio (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  provider_id UUID NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  image_url TEXT NOT NULL,
  display_order INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_provider_portfolio_provider_id ON provider_portfolio(provider_id);
CREATE INDEX IF NOT EXISTS idx_provider_portfolio_order       ON provider_portfolio(provider_id, display_order);

-- =============================================================================
-- NOTIFICATION PREFERENCES
-- =============================================================================

CREATE TABLE IF NOT EXISTS notification_preferences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  email_notifications BOOLEAN DEFAULT true,
  sms_notifications BOOLEAN DEFAULT true,
  push_notifications BOOLEAN DEFAULT true,
  marketing_emails BOOLEAN DEFAULT false,
  new_request_alerts BOOLEAN DEFAULT true,
  proposal_alerts BOOLEAN DEFAULT true,
  job_updates BOOLEAN DEFAULT true,
  payment_alerts BOOLEAN DEFAULT true,
  review_alerts BOOLEAN DEFAULT true,
  message_alerts BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT now() NOT NULL,
  updated_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_notification_preferences_user_id ON notification_preferences(user_id);

-- Trigger: auto-update updated_at
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'update_notification_preferences_updated_at'
  ) THEN
    CREATE TRIGGER update_notification_preferences_updated_at
      BEFORE UPDATE ON notification_preferences
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END;
$$;

-- =============================================================================
-- PRICING PLANS
-- =============================================================================

CREATE TABLE IF NOT EXISTS pricing_plans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL,
  description TEXT,
  price BIGINT NOT NULL,
  billing_period TEXT NOT NULL CHECK (billing_period IN ('monthly', 'yearly')),
  features JSONB,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT now() NOT NULL
);

-- =============================================================================
-- SAVED PAYMENT METHODS
-- =============================================================================

CREATE TABLE IF NOT EXISTS saved_payment_methods (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  payment_type TEXT NOT NULL CHECK (payment_type IN ('card', 'bank_account', 'paypal', 'other')),
  card_brand TEXT,
  last_four VARCHAR(4),
  expiry_month INT,
  expiry_year INT,
  is_default BOOLEAN DEFAULT false,
  billing_email TEXT,
  gateway_customer_id TEXT,
  gateway_payment_method_id TEXT,
  created_at TIMESTAMP DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_saved_payment_methods_user_id
  ON saved_payment_methods(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_payment_methods_default
  ON saved_payment_methods(user_id, is_default);
CREATE UNIQUE INDEX IF NOT EXISTS idx_saved_payment_methods_one_default
  ON saved_payment_methods(user_id)
  WHERE is_default = true;
CREATE INDEX IF NOT EXISTS idx_saved_payment_methods_gateway_customer
  ON saved_payment_methods(gateway_customer_id)
  WHERE gateway_customer_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_saved_payment_methods_gateway_method
  ON saved_payment_methods(gateway_payment_method_id)
  WHERE gateway_payment_method_id IS NOT NULL;

-- =============================================================================
-- SUBSCRIPTIONS
-- NOTE: display_id column is added/backfilled by migration 016.
--       If 016 runs before 017 on an existing DB it will fail because the table
--       won't exist yet. Run 017 first, then 016 on empty databases.
--       On fresh schema.sql installs both columns are present from the start.
-- =============================================================================

CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  display_id VARCHAR(11) UNIQUE,               -- populated by trigger from migration 016
  provider_id UUID NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES pricing_plans(id),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('active', 'cancelled', 'expired', 'pending')),
  started_at TIMESTAMP DEFAULT now(),
  expires_at TIMESTAMP,
  cancelled_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_provider_id      ON subscriptions(provider_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status           ON subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_expires_at       ON subscriptions(expires_at) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_subscriptions_provider_status  ON subscriptions(provider_id, status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_active_covering
  ON subscriptions(provider_id) INCLUDE (plan_id, status, expires_at)
  WHERE status = 'active';

-- Backfill display_id for any rows inserted before trigger is in place
-- (safe no-op if table is empty or trigger already ran)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'subscriptions' AND column_name = 'display_id'
  ) THEN
    UPDATE subscriptions
    SET display_id = generate_display_id('SUB')
    WHERE display_id IS NULL;
  END IF;
END;
$$;

COMMIT;
