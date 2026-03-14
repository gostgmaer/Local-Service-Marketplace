-- =====================================================
-- Production Readiness Migration
-- Version: 002
-- Date: March 14, 2026
-- Priority: CRITICAL - Must apply before production
-- =====================================================

BEGIN;

-- =====================================================
-- 1. ADD NOT NULL CONSTRAINTS
-- =====================================================

-- Users table
ALTER TABLE users ALTER COLUMN password_hash SET NOT NULL;
ALTER TABLE users ALTER COLUMN created_at SET NOT NULL;

-- Service Requests
ALTER TABLE service_requests ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE service_requests ALTER COLUMN category_id SET NOT NULL;
ALTER TABLE service_requests ALTER COLUMN description SET NOT NULL;
ALTER TABLE service_requests ALTER COLUMN budget SET NOT NULL;
ALTER TABLE service_requests ALTER COLUMN status SET NOT NULL;
ALTER TABLE service_requests ALTER COLUMN created_at SET NOT NULL;

-- Proposals
ALTER TABLE proposals ALTER COLUMN request_id SET NOT NULL;
ALTER TABLE proposals ALTER COLUMN provider_id SET NOT NULL;
ALTER TABLE proposals ALTER COLUMN price SET NOT NULL;
ALTER TABLE proposals ALTER COLUMN status SET NOT NULL;
ALTER TABLE proposals ALTER COLUMN created_at SET NOT NULL;

-- Jobs
ALTER TABLE jobs ALTER COLUMN request_id SET NOT NULL;
ALTER TABLE jobs ALTER COLUMN provider_id SET NOT NULL;
ALTER TABLE jobs ALTER COLUMN status SET NOT NULL;

-- Payments
ALTER TABLE payments ALTER COLUMN job_id SET NOT NULL;
ALTER TABLE payments ALTER COLUMN amount SET NOT NULL;
ALTER TABLE payments ALTER COLUMN currency SET NOT NULL;
ALTER TABLE payments ALTER COLUMN status SET NOT NULL;
ALTER TABLE payments ALTER COLUMN created_at SET NOT NULL;

-- Reviews
ALTER TABLE reviews ALTER COLUMN job_id SET NOT NULL;
ALTER TABLE reviews ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE reviews ALTER COLUMN provider_id SET NOT NULL;
ALTER TABLE reviews ALTER COLUMN rating SET NOT NULL;
ALTER TABLE reviews ALTER COLUMN created_at SET NOT NULL;

-- Messages
ALTER TABLE messages ALTER COLUMN job_id SET NOT NULL;
ALTER TABLE messages ALTER COLUMN sender_id SET NOT NULL;
ALTER TABLE messages ALTER COLUMN message SET NOT NULL;
ALTER TABLE messages ALTER COLUMN created_at SET NOT NULL;

-- Notifications
ALTER TABLE notifications ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE notifications ALTER COLUMN type SET NOT NULL;
ALTER TABLE notifications ALTER COLUMN message SET NOT NULL;
ALTER TABLE notifications ALTER COLUMN created_at SET NOT NULL;

-- Providers
ALTER TABLE providers ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE providers ALTER COLUMN business_name SET NOT NULL;
ALTER TABLE providers ALTER COLUMN created_at SET NOT NULL;

-- Service Categories
ALTER TABLE service_categories ALTER COLUMN name SET NOT NULL;
ALTER TABLE service_categories ALTER COLUMN created_at SET NOT NULL;

-- =====================================================
-- 2. ADD CHECK CONSTRAINTS
-- =====================================================

-- Users
ALTER TABLE users ADD CONSTRAINT check_role_valid 
  CHECK (role IN ('customer', 'provider', 'admin'));

ALTER TABLE users ADD CONSTRAINT check_status_valid 
  CHECK (status IN ('active', 'suspended', 'deleted'));

-- Service Requests
ALTER TABLE service_requests ADD CONSTRAINT check_budget_positive 
  CHECK (budget > 0);

ALTER TABLE service_requests ADD CONSTRAINT check_status_valid 
  CHECK (status IN ('open', 'assigned', 'completed', 'cancelled'));

-- Proposals
ALTER TABLE proposals ADD CONSTRAINT check_price_positive 
  CHECK (price > 0);

ALTER TABLE proposals ADD CONSTRAINT check_status_valid 
  CHECK (status IN ('pending', 'accepted', 'rejected', 'withdrawn'));

-- Jobs
ALTER TABLE jobs ADD CONSTRAINT check_status_valid 
  CHECK (status IN ('scheduled', 'in_progress', 'completed', 'cancelled', 'disputed'));

ALTER TABLE jobs ADD CONSTRAINT check_dates_logical 
  CHECK (completed_at IS NULL OR completed_at >= started_at);

-- Payments
ALTER TABLE payments ADD CONSTRAINT check_amount_positive 
  CHECK (amount > 0);

ALTER TABLE payments ADD CONSTRAINT check_status_valid 
  CHECK (status IN ('pending', 'completed', 'failed', 'refunded'));

-- Reviews
ALTER TABLE reviews ADD CONSTRAINT check_rating_range 
  CHECK (rating >= 1 AND rating <= 5);

-- Provider Availability
ALTER TABLE provider_availability ADD CONSTRAINT check_day_of_week 
  CHECK (day_of_week >= 0 AND day_of_week <= 6);

ALTER TABLE provider_availability ADD CONSTRAINT check_time_logical 
  CHECK (end_time > start_time);

-- Coupons
ALTER TABLE coupons ADD CONSTRAINT check_discount_range 
  CHECK (discount_percent > 0 AND discount_percent <= 100);

-- =====================================================
-- 3. ADD MISSING FOREIGN KEY CONSTRAINTS
-- =====================================================

-- Provider services to categories
ALTER TABLE provider_services ADD CONSTRAINT provider_services_category_id_fkey 
  FOREIGN KEY (category_id) REFERENCES service_categories(id) ON DELETE RESTRICT;

-- =====================================================
-- 4. ADD CRITICAL PERFORMANCE INDEXES
-- =====================================================

-- Users table
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at DESC);

-- Sessions
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);

-- Providers
CREATE INDEX IF NOT EXISTS idx_providers_user_id ON providers(user_id);
CREATE INDEX IF NOT EXISTS idx_providers_rating ON providers(rating DESC);

-- Provider Services
CREATE INDEX IF NOT EXISTS idx_provider_services_provider_id ON provider_services(provider_id);
CREATE INDEX IF NOT EXISTS idx_provider_services_category_id ON provider_services(category_id);

-- Service Requests
CREATE INDEX IF NOT EXISTS idx_service_requests_user_id ON service_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_service_requests_category_id ON service_requests(category_id);
CREATE INDEX IF NOT EXISTS idx_service_requests_status ON service_requests(status);
CREATE INDEX IF NOT EXISTS idx_service_requests_created_at ON service_requests(created_at DESC);

-- Proposals
CREATE INDEX IF NOT EXISTS idx_proposals_request_id ON proposals(request_id);
CREATE INDEX IF NOT EXISTS idx_proposals_provider_id ON proposals(provider_id);
CREATE INDEX IF NOT EXISTS idx_proposals_status ON proposals(status);
CREATE INDEX IF NOT EXISTS idx_proposals_created_at ON proposals(created_at DESC);

-- Jobs
CREATE INDEX IF NOT EXISTS idx_jobs_request_id ON jobs(request_id);
CREATE INDEX IF NOT EXISTS idx_jobs_provider_id ON jobs(provider_id);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);

-- Payments
CREATE INDEX IF NOT EXISTS idx_payments_job_id ON payments(job_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_created_at ON payments(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payments_transaction_id ON payments(transaction_id);

-- Payment Webhooks (partial index for unprocessed)
CREATE INDEX IF NOT EXISTS idx_payment_webhooks_unprocessed 
  ON payment_webhooks(processed) WHERE processed = false;

-- Reviews
CREATE INDEX IF NOT EXISTS idx_reviews_job_id ON reviews(job_id);
CREATE INDEX IF NOT EXISTS idx_reviews_provider_id ON reviews(provider_id);
CREATE INDEX IF NOT EXISTS idx_reviews_user_id ON reviews(user_id);
CREATE INDEX IF NOT EXISTS idx_reviews_created_at ON reviews(created_at DESC);

-- Messages
CREATE INDEX IF NOT EXISTS idx_messages_job_id ON messages(job_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at ASC);

-- Notifications
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_unread 
  ON notifications(read) WHERE read = false;
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);

-- Favorites
CREATE INDEX IF NOT EXISTS idx_favorites_user_id ON favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_favorites_provider_id ON favorites(provider_id);

-- Social Accounts
CREATE INDEX IF NOT EXISTS idx_social_accounts_user_id ON social_accounts(user_id);

-- User Activity Logs
CREATE INDEX IF NOT EXISTS idx_user_activity_user_id ON user_activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_user_activity_created_at ON user_activity_logs(created_at DESC);

-- Audit Logs
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);

-- Events
CREATE INDEX IF NOT EXISTS idx_events_event_type ON events(event_type);
CREATE INDEX IF NOT EXISTS idx_events_created_at ON events(created_at DESC);

-- Background Jobs (partial index for pending)
CREATE INDEX IF NOT EXISTS idx_background_jobs_pending 
  ON background_jobs(status) WHERE status != 'completed';

-- Rate Limits
CREATE INDEX IF NOT EXISTS idx_rate_limits_key ON rate_limits(key);
CREATE INDEX IF NOT EXISTS idx_rate_limits_window_start ON rate_limits(window_start);

-- Disputes
CREATE INDEX IF NOT EXISTS idx_disputes_job_id ON disputes(job_id);
CREATE INDEX IF NOT EXISTS idx_disputes_status ON disputes(status);
CREATE INDEX IF NOT EXISTS idx_disputes_opened_by ON disputes(opened_by);

-- Coupon Usage
CREATE INDEX IF NOT EXISTS idx_coupon_usage_user_id ON coupon_usage(user_id);
CREATE INDEX IF NOT EXISTS idx_coupon_usage_coupon_id ON coupon_usage(coupon_id);

-- =====================================================
-- 5. ADD UNIQUE CONSTRAINTS
-- =====================================================

-- Prevent duplicate provider per user
ALTER TABLE providers ADD CONSTRAINT providers_user_id_unique UNIQUE (user_id);

-- Prevent duplicate favorites
CREATE UNIQUE INDEX IF NOT EXISTS idx_favorites_unique ON favorites(user_id, provider_id);

-- Prevent duplicate reviews per job
CREATE UNIQUE INDEX IF NOT EXISTS idx_reviews_job_user_unique ON reviews(job_id, user_id);

-- Prevent duplicate provider services
CREATE UNIQUE INDEX IF NOT EXISTS idx_provider_services_unique 
  ON provider_services(provider_id, category_id);

-- Prevent duplicate social account connections
CREATE UNIQUE INDEX IF NOT EXISTS idx_social_accounts_provider_unique 
  ON social_accounts(provider, provider_user_id);

-- =====================================================
-- 6. ADD MISSING TIMESTAMPS
-- =====================================================

-- Add created_at to jobs
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT now() NOT NULL;

-- Add updated_at to key tables
ALTER TABLE service_requests ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP;
ALTER TABLE proposals ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP;

-- Add dispute metadata
ALTER TABLE disputes ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT now();
ALTER TABLE disputes ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP;
ALTER TABLE disputes ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMP;
ALTER TABLE disputes ADD COLUMN IF NOT EXISTS resolved_by UUID REFERENCES users(id);
ALTER TABLE disputes ADD COLUMN IF NOT EXISTS resolution TEXT;

-- =====================================================
-- 7. CREATE UPDATE TRIGGER FUNCTION
-- =====================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to tables with updated_at
CREATE TRIGGER update_users_updated_at 
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_service_requests_updated_at 
  BEFORE UPDATE ON service_requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_proposals_updated_at 
  BEFORE UPDATE ON proposals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_jobs_updated_at 
  BEFORE UPDATE ON jobs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_disputes_updated_at 
  BEFORE UPDATE ON disputes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 8. ADD CASCADING DELETES (Critical for data integrity)
-- =====================================================

-- Sessions
ALTER TABLE sessions DROP CONSTRAINT IF EXISTS sessions_user_id_fkey;
ALTER TABLE sessions ADD CONSTRAINT sessions_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- Email verification tokens
ALTER TABLE email_verification_tokens DROP CONSTRAINT IF EXISTS email_verification_tokens_user_id_fkey;
ALTER TABLE email_verification_tokens ADD CONSTRAINT email_verification_tokens_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- Password reset tokens
ALTER TABLE password_reset_tokens DROP CONSTRAINT IF EXISTS password_reset_tokens_user_id_fkey;
ALTER TABLE password_reset_tokens ADD CONSTRAINT password_reset_tokens_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- Social accounts
ALTER TABLE social_accounts DROP CONSTRAINT IF EXISTS social_accounts_user_id_fkey;
ALTER TABLE social_accounts ADD CONSTRAINT social_accounts_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- User devices
ALTER TABLE user_devices DROP CONSTRAINT IF EXISTS user_devices_user_id_fkey;
ALTER TABLE user_devices ADD CONSTRAINT user_devices_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- Providers
ALTER TABLE providers DROP CONSTRAINT IF EXISTS providers_user_id_fkey;
ALTER TABLE providers ADD CONSTRAINT providers_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- Provider services
ALTER TABLE provider_services DROP CONSTRAINT IF EXISTS provider_services_provider_id_fkey;
ALTER TABLE provider_services ADD CONSTRAINT provider_services_provider_id_fkey 
  FOREIGN KEY (provider_id) REFERENCES providers(id) ON DELETE CASCADE;

-- Provider availability
ALTER TABLE provider_availability DROP CONSTRAINT IF EXISTS provider_availability_provider_id_fkey;
ALTER TABLE provider_availability ADD CONSTRAINT provider_availability_provider_id_fkey 
  FOREIGN KEY (provider_id) REFERENCES providers(id) ON DELETE CASCADE;

-- Proposals
ALTER TABLE proposals DROP CONSTRAINT IF EXISTS proposals_request_id_fkey;
ALTER TABLE proposals ADD CONSTRAINT proposals_request_id_fkey 
  FOREIGN KEY (request_id) REFERENCES service_requests(id) ON DELETE CASCADE;

ALTER TABLE proposals DROP CONSTRAINT IF EXISTS proposals_provider_id_fkey;
ALTER TABLE proposals ADD CONSTRAINT proposals_provider_id_fkey 
  FOREIGN KEY (provider_id) REFERENCES providers(id) ON DELETE CASCADE;

-- Messages
ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_job_id_fkey;
ALTER TABLE messages ADD CONSTRAINT messages_job_id_fkey 
  FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE;

-- Notifications
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_user_id_fkey;
ALTER TABLE notifications ADD CONSTRAINT notifications_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- Notification deliveries
ALTER TABLE notification_deliveries DROP CONSTRAINT IF EXISTS notification_deliveries_notification_id_fkey;
ALTER TABLE notification_deliveries ADD CONSTRAINT notification_deliveries_notification_id_fkey 
  FOREIGN KEY (notification_id) REFERENCES notifications(id) ON DELETE CASCADE;

-- Favorites
ALTER TABLE favorites DROP CONSTRAINT IF EXISTS favorites_user_id_fkey;
ALTER TABLE favorites DROP CONSTRAINT IF EXISTS favorites_provider_id_fkey;
ALTER TABLE favorites ADD CONSTRAINT favorites_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE favorites ADD CONSTRAINT favorites_provider_id_fkey 
  FOREIGN KEY (provider_id) REFERENCES providers(id) ON DELETE CASCADE;

-- Coupon usage
ALTER TABLE coupon_usage DROP CONSTRAINT IF EXISTS coupon_usage_coupon_id_fkey;
ALTER TABLE coupon_usage DROP CONSTRAINT IF EXISTS coupon_usage_user_id_fkey;
ALTER TABLE coupon_usage ADD CONSTRAINT coupon_usage_coupon_id_fkey 
  FOREIGN KEY (coupon_id) REFERENCES coupons(id) ON DELETE CASCADE;
ALTER TABLE coupon_usage ADD CONSTRAINT coupon_usage_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- Refunds
ALTER TABLE refunds DROP CONSTRAINT IF EXISTS refunds_payment_id_fkey;
ALTER TABLE refunds ADD CONSTRAINT refunds_payment_id_fkey 
  FOREIGN KEY (payment_id) REFERENCES payments(id) ON DELETE CASCADE;

-- User activity logs
ALTER TABLE user_activity_logs DROP CONSTRAINT IF EXISTS user_activity_logs_user_id_fkey;
ALTER TABLE user_activity_logs ADD CONSTRAINT user_activity_logs_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

COMMIT;

-- =====================================================
-- Migration Complete
-- =====================================================

-- Verify the migration
SELECT 
  'Migration 002 completed successfully' as status,
  NOW() as completed_at;
