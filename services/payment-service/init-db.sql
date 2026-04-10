-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Payments table
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  display_id VARCHAR(11) UNIQUE NOT NULL,
  job_id UUID NOT NULL,
  user_id UUID NOT NULL,
  provider_id UUID NOT NULL,
  amount BIGINT NOT NULL CHECK (amount > 0),
  platform_fee BIGINT DEFAULT 0,
  provider_amount BIGINT,
  currency TEXT NOT NULL,
  payment_method TEXT,
  gateway TEXT NOT NULL DEFAULT 'mock',
  status TEXT NOT NULL CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),
  transaction_id TEXT,
  failed_reason TEXT,
  created_at TIMESTAMP DEFAULT now() NOT NULL,
  paid_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_payments_job_id ON payments(job_id);
CREATE INDEX IF NOT EXISTS idx_payments_user_id ON payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_provider_id ON payments(provider_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_created_at ON payments(created_at DESC);

-- Payment Webhooks table
CREATE TABLE IF NOT EXISTS payment_webhooks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  gateway TEXT NOT NULL,
  payload JSONB NOT NULL,
  processed BOOLEAN DEFAULT false NOT NULL,
  event_type TEXT,
  external_id TEXT,
  created_at TIMESTAMP DEFAULT now() NOT NULL,
  processed_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_payment_webhooks_unprocessed ON payment_webhooks(processed) WHERE processed = false;

-- Refunds table
CREATE TABLE IF NOT EXISTS refunds (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  display_id VARCHAR(11) UNIQUE NOT NULL,
  payment_id UUID NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
  amount BIGINT NOT NULL CHECK (amount > 0),
  status TEXT NOT NULL CHECK (status IN ('pending', 'completed', 'failed')),
  reason TEXT,
  created_at TIMESTAMP DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_refunds_payment_id ON refunds(payment_id);

-- Coupons table
CREATE TABLE IF NOT EXISTS coupons (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  display_id VARCHAR(11) UNIQUE NOT NULL,
  code VARCHAR(50) UNIQUE NOT NULL,
  discount_percent INT NOT NULL CHECK (discount_percent > 0 AND discount_percent <= 100),
  max_uses INT,
  max_uses_per_user INT DEFAULT 1,
  min_purchase_amount BIGINT DEFAULT 0,
  active BOOLEAN DEFAULT true,
  created_by UUID,
  expires_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_coupons_code ON coupons(code);

-- Coupon Usage table
CREATE TABLE IF NOT EXISTS coupon_usage (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  coupon_id UUID NOT NULL REFERENCES coupons(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  used_at TIMESTAMP DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_coupon_usage_user_id ON coupon_usage(user_id);
CREATE INDEX IF NOT EXISTS idx_coupon_usage_coupon_id ON coupon_usage(coupon_id);

-- Note: Other tables like 'jobs' and 'users' are managed by their respective services 
-- but referenced here for local testing consistency.
