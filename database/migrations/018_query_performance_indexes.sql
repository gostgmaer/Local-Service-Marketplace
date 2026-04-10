-- =====================================================
-- QUERY PERFORMANCE INDEXES — Gap Fill
-- Date: April 10, 2026
-- Purpose: Cover all unindexed query patterns found in
--          cross-repository audit across all 6 services.
--
-- Patterns addressed:
--   • providers  ILIKE search on business_name
--   • providers  range filters on response_time_avg,
--                years_of_experience, service_area_radius
--   • payments   equality filter on payment_method
--   • pricing_plans  active = true  (no indexes at all)
--   • saved_payment_methods  arithmetic expiry expression
--   • reviews    (provider_id, response_at) WHERE response IS NOT NULL
--   • disputes   (status, created_at DESC) for paginated list
--   • admin_actions  (target_type, target_id) lookup
--   • users      email ILIKE '%search%' (admin search)
--   • audit_logs multi-column dynamic filters
--   • autovacuum tuning for new tables (from migration 017)
--   • statistics targets for query planner on filter columns
-- =====================================================

BEGIN;

-- =====================================================
-- 1. PROVIDERS — ILIKE SEARCH
-- =====================================================

-- GIN trigram index for business_name ILIKE '%search%'
-- Used in: findPaginated, countProviders
-- pg_trgm extension is already enabled in schema.sql
CREATE INDEX IF NOT EXISTS idx_providers_business_name_trgm
  ON providers USING GIN (business_name gin_trgm_ops)
  WHERE deleted_at IS NULL;

COMMENT ON INDEX idx_providers_business_name_trgm
  IS 'Enables fast ILIKE "%search%" on provider business name without sequential scan';

-- GIN trigram index for description ILIKE '%search%'
-- description is TEXT so store as tsvector-like; we use trgm for consistency
CREATE INDEX IF NOT EXISTS idx_providers_description_trgm
  ON providers USING GIN (description gin_trgm_ops)
  WHERE deleted_at IS NULL;

COMMENT ON INDEX idx_providers_description_trgm
  IS 'Enables fast ILIKE "%search%" on provider description; avoids full table scan';

-- =====================================================
-- 2. PROVIDERS — NUMERIC RANGE FILTERS
-- =====================================================

-- response_time_avg <= $1  (getProvidersByResponseTime)
CREATE INDEX IF NOT EXISTS idx_providers_response_time_avg
  ON providers(response_time_avg ASC)
  WHERE deleted_at IS NULL AND response_time_avg IS NOT NULL;

COMMENT ON INDEX idx_providers_response_time_avg
  IS 'Supports range queries filtering providers by average response time';

-- years_of_experience >= $1  (getProvidersByExperience)
CREATE INDEX IF NOT EXISTS idx_providers_years_experience
  ON providers(years_of_experience DESC)
  WHERE deleted_at IS NULL AND years_of_experience IS NOT NULL;

COMMENT ON INDEX idx_providers_years_experience
  IS 'Supports range queries filtering providers by years of experience';

-- service_area_radius BETWEEN $1 AND $2  (getProvidersByServiceRadius)
CREATE INDEX IF NOT EXISTS idx_providers_service_area_radius
  ON providers(service_area_radius)
  WHERE deleted_at IS NULL AND service_area_radius IS NOT NULL;

COMMENT ON INDEX idx_providers_service_area_radius
  IS 'Supports BETWEEN range filter on service area radius';

-- Composite: verification_status + rating for top-rated + verified queries
CREATE INDEX IF NOT EXISTS idx_providers_verified_rating
  ON providers(verification_status, rating DESC)
  WHERE deleted_at IS NULL AND verification_status = 'verified';

COMMENT ON INDEX idx_providers_verified_rating
  IS 'Covers getTopRatedProviders filtering by verified status and sorting by rating';

-- =====================================================
-- 3. PAYMENTS — PAYMENT METHOD FILTER
-- =====================================================

-- payment_method = $1  (getPaymentsByPaymentMethod, paginated filters)
CREATE INDEX IF NOT EXISTS idx_payments_payment_method
  ON payments(payment_method)
  WHERE payment_method IS NOT NULL;

COMMENT ON INDEX idx_payments_payment_method
  IS 'Supports equality filter on payment_method in payment list queries';

-- Composite for combined user/provider + status + date range queries
-- The OR pattern (user_id=$1 OR provider_id=$1) benefits from UNION ALL plan
-- but a covering composite helps when status is also filtered
CREATE INDEX IF NOT EXISTS idx_payments_user_status_created
  ON payments(user_id, status, created_at DESC);

COMMENT ON INDEX idx_payments_user_status_created
  IS 'Covers paginated payment list queries filtered by user + status + date range';

CREATE INDEX IF NOT EXISTS idx_payments_provider_status_created
  ON payments(provider_id, status, created_at DESC);

COMMENT ON INDEX idx_payments_provider_status_created
  IS 'Covers paginated payment list queries filtered by provider + status + date range';

-- =====================================================
-- 4. PRICING PLANS — NO INDEXES EXIST
-- =====================================================

-- active = true filter  (findAll with activeOnly=true)
CREATE INDEX IF NOT EXISTS idx_pricing_plans_active
  ON pricing_plans(active)
  WHERE active = true;

COMMENT ON INDEX idx_pricing_plans_active
  IS 'Filters for active pricing plans; no other indexes existed on this table';

-- billing_period filter if added in future queries
CREATE INDEX IF NOT EXISTS idx_pricing_plans_billing_period
  ON pricing_plans(billing_period, active);

COMMENT ON INDEX idx_pricing_plans_billing_period
  IS 'Composite for potential billing_period + active filter queries';

-- Price sorting
CREATE INDEX IF NOT EXISTS idx_pricing_plans_price
  ON pricing_plans(price ASC);

COMMENT ON INDEX idx_pricing_plans_price
  IS 'Supports ORDER BY price ASC in plan listing queries';

-- Autovacuum tuning for pricing_plans
ALTER TABLE pricing_plans SET (
  autovacuum_vacuum_scale_factor = 0.05,
  autovacuum_analyze_scale_factor = 0.02
);

-- =====================================================
-- 5. SAVED PAYMENT METHODS — EXPIRY EXPRESSION INDEX
-- =====================================================

-- findExpiringWithinMonths uses:
--   (expiry_year * 12 + expiry_month) BETWEEN $1 AND $2
-- Standard B-tree indexes on individual columns cannot serve this;
-- a functional index on the expression is required.
CREATE INDEX IF NOT EXISTS idx_saved_payment_methods_expiry_expr
  ON saved_payment_methods((expiry_year * 12 + expiry_month))
  WHERE expiry_year IS NOT NULL AND expiry_month IS NOT NULL;

COMMENT ON INDEX idx_saved_payment_methods_expiry_expr
  IS 'Functional index for arithmetic expiry expression (year*12+month BETWEEN) in findExpiringWithinMonths';

-- Autovacuum tuning for saved_payment_methods
ALTER TABLE saved_payment_methods SET (
  autovacuum_vacuum_scale_factor = 0.05,
  autovacuum_analyze_scale_factor = 0.02
);

-- =====================================================
-- 6. REVIEWS — RESPONSE AND HELPFUL FILTERS
-- =====================================================

-- provider_id + response IS NOT NULL (getReviewsWithResponses)
CREATE INDEX IF NOT EXISTS idx_reviews_provider_response
  ON reviews(provider_id, response_at DESC)
  WHERE response IS NOT NULL;

COMMENT ON INDEX idx_reviews_provider_response
  IS 'Covers getReviewsWithResponses: filters by provider where response is not null, sorted by response_at';

-- provider_id + rating = $2 filter (getReviewsByRating)
CREATE INDEX IF NOT EXISTS idx_reviews_provider_rating_eq
  ON reviews(provider_id, rating, created_at DESC);

COMMENT ON INDEX idx_reviews_provider_rating_eq
  IS 'Covers getReviewsByRating: provider + specific rating equality + date sort';

-- provider_id + verified_purchase = true (getVerifiedPurchaseReviews)
CREATE INDEX IF NOT EXISTS idx_reviews_provider_verified
  ON reviews(provider_id, created_at DESC)
  WHERE verified_purchase = true;

COMMENT ON INDEX idx_reviews_provider_verified
  IS 'Covers getVerifiedPurchaseReviews: filters verified purchases per provider';

-- =====================================================
-- 7. DISPUTES — PAGINATED STATUS LIST
-- =====================================================

-- findDisputes: dynamic filters on status + created_at date range
CREATE INDEX IF NOT EXISTS idx_disputes_status_created_at
  ON disputes(status, created_at DESC);

COMMENT ON INDEX idx_disputes_status_created_at
  IS 'Covers findDisputes paginated list sorted by status and created_at';

-- resolved_at for sorting/filtering resolved disputes
CREATE INDEX IF NOT EXISTS idx_disputes_resolved_at
  ON disputes(resolved_at DESC)
  WHERE resolved_at IS NOT NULL;

COMMENT ON INDEX idx_disputes_resolved_at
  IS 'Covers sorting/filtering resolved disputes by resolution date';

-- Autovacuum tuning for disputes
ALTER TABLE disputes SET (
  autovacuum_vacuum_scale_factor = 0.05,
  autovacuum_analyze_scale_factor = 0.02
);

-- =====================================================
-- 8. ADMIN ACTIONS — TARGET ENTITY LOOKUP
-- =====================================================

-- target_type + target_id: referenced in action logging but not yet queryable
CREATE INDEX IF NOT EXISTS idx_admin_actions_target
  ON admin_actions(target_type, target_id, created_at DESC);

COMMENT ON INDEX idx_admin_actions_target
  IS 'Enables lookup of all admin actions against a specific entity (target_type + target_id)';

-- Autovacuum tuning for admin_actions
ALTER TABLE admin_actions SET (
  autovacuum_vacuum_scale_factor = 0.05,
  autovacuum_analyze_scale_factor = 0.02
);

-- =====================================================
-- 9. USERS — EMAIL ILIKE SEARCH (ADMIN)
-- =====================================================

-- findAllForAdmin uses: email ILIKE '%search%' OR name ILIKE '%search%'
-- name already has GIN trgm from schema (idx_users_name_trgm)
-- email now gets GIN trgm for leading-wildcard support
CREATE INDEX IF NOT EXISTS idx_users_email_trgm
  ON users USING GIN (email gin_trgm_ops)
  WHERE deleted_at IS NULL;

COMMENT ON INDEX idx_users_email_trgm
  IS 'Enables fast ILIKE "%search%" on user email for admin search (leading wildcard)';

-- =====================================================
-- 10. AUDIT LOGS — MULTI-COLUMN DYNAMIC FILTERS
-- =====================================================

-- findAuditLogs: dynamic: user_id, action, entity, entity_id, created_at range
-- Composite covering common cross-filter paths
CREATE INDEX IF NOT EXISTS idx_audit_logs_action_entity_created
  ON audit_logs(action, entity, created_at DESC);

COMMENT ON INDEX idx_audit_logs_action_entity_created
  IS 'Covers dynamic findAuditLogs queries filtering on action + entity + date range';

CREATE INDEX IF NOT EXISTS idx_audit_logs_user_action_created
  ON audit_logs(user_id, action, created_at DESC)
  WHERE user_id IS NOT NULL;

COMMENT ON INDEX idx_audit_logs_user_action_created
  IS 'Covers findAuditLogs queries filtering on user_id + action + date range';

-- BRIN index for bulk time-range scans on append-only audit_logs
CREATE INDEX IF NOT EXISTS idx_audit_logs_brin
  ON audit_logs USING BRIN(created_at)
  WITH (pages_per_range = 32);

COMMENT ON INDEX idx_audit_logs_brin
  IS 'BRIN index for time-range scans on append-only audit_logs table';

-- Autovacuum tuning for audit_logs (append-only, high volume)
ALTER TABLE audit_logs SET (
  autovacuum_vacuum_scale_factor = 0.1,
  autovacuum_analyze_scale_factor = 0.05
);

-- =====================================================
-- 11. NOTIFICATION PREFERENCES — DYNAMIC COLUMN FILTER
-- =====================================================

-- getUsersWithPreference queries a dynamic boolean column by name
-- Each boolean column is accessed individually via dynamic SQL
-- Partial indexes on commonly checked preference columns would help
CREATE INDEX IF NOT EXISTS idx_notif_prefs_email
  ON notification_preferences(email_notifications)
  WHERE email_notifications = true;

CREATE INDEX IF NOT EXISTS idx_notif_prefs_sms
  ON notification_preferences(sms_notifications)
  WHERE sms_notifications = true;

CREATE INDEX IF NOT EXISTS idx_notif_prefs_push
  ON notification_preferences(push_notifications)
  WHERE push_notifications = true;

COMMENT ON INDEX idx_notif_prefs_email
  IS 'Partial index for getUsersWithPreference filtering users with email notifications enabled';

-- Autovacuum for notification_preferences
ALTER TABLE notification_preferences SET (
  autovacuum_vacuum_scale_factor = 0.05,
  autovacuum_analyze_scale_factor = 0.02
);

-- =====================================================
-- 12. SUBSCRIPTIONS — EXPIRY RANGE QUERIES
-- =====================================================

-- getExpiringSubscriptions: status = 'active' AND expires_at BETWEEN NOW() AND NOW()+INTERVAL
-- Schema has idx_subscriptions_expires_at WHERE status = 'active'
-- Add composite to cover status + expires_at range together
CREATE INDEX IF NOT EXISTS idx_subscriptions_active_expires
  ON subscriptions(expires_at ASC)
  WHERE status = 'active' AND expires_at IS NOT NULL;

COMMENT ON INDEX idx_subscriptions_active_expires
  IS 'Optimizes getExpiringSubscriptions: range scan on expires_at for active subscriptions only';

-- Autovacuum for subscriptions
ALTER TABLE subscriptions SET (
  autovacuum_vacuum_scale_factor = 0.05,
  autovacuum_analyze_scale_factor = 0.02
);

-- =====================================================
-- 13. PROVIDER DOCUMENTS — PENDING/EXPIRING QUERIES
-- =====================================================

-- getPendingDocuments: verified = false, ORDER BY created_at ASC
CREATE INDEX IF NOT EXISTS idx_provider_documents_pending
  ON provider_documents(provider_id, created_at ASC)
  WHERE verified = false AND rejected = false;

COMMENT ON INDEX idx_provider_documents_pending
  IS 'Covers getPendingDocuments: unverified, unrejected documents sorted oldest first';

-- getExpiringDocuments: verified = true AND expires_at range
CREATE INDEX IF NOT EXISTS idx_provider_documents_expiring
  ON provider_documents(expires_at ASC)
  WHERE verified = true AND expires_at IS NOT NULL;

COMMENT ON INDEX idx_provider_documents_expiring
  IS 'Covers getExpiringDocuments: verified documents with upcoming expiry';

-- Autovacuum for provider_documents (low write volume)
ALTER TABLE provider_documents SET (
  autovacuum_vacuum_scale_factor = 0.1,
  autovacuum_analyze_scale_factor = 0.05
);

-- Autovacuum for provider_portfolio
ALTER TABLE provider_portfolio SET (
  autovacuum_vacuum_scale_factor = 0.1,
  autovacuum_analyze_scale_factor = 0.05
);

-- =====================================================
-- 14. STATISTICS TARGETS — QUERY PLANNER TUNING
-- =====================================================

-- Increase statistics target for frequently filtered low-cardinality columns
-- so the planner uses better selectivity estimates
ALTER TABLE providers ALTER COLUMN verification_status SET STATISTICS 500;
ALTER TABLE providers ALTER COLUMN rating SET STATISTICS 1000;
ALTER TABLE providers ALTER COLUMN response_time_avg SET STATISTICS 500;

ALTER TABLE disputes ALTER COLUMN status SET STATISTICS 500;

ALTER TABLE notifications ALTER COLUMN type SET STATISTICS 500;

ALTER TABLE pricing_plans ALTER COLUMN billing_period SET STATISTICS 100;
ALTER TABLE pricing_plans ALTER COLUMN active SET STATISTICS 100;

ALTER TABLE payments ALTER COLUMN payment_method SET STATISTICS 500;
ALTER TABLE payments ALTER COLUMN gateway SET STATISTICS 200;

ALTER TABLE audit_logs ALTER COLUMN action SET STATISTICS 500;
ALTER TABLE audit_logs ALTER COLUMN entity SET STATISTICS 500;

ALTER TABLE background_jobs ALTER COLUMN job_type SET STATISTICS 500;

-- =====================================================
-- 15. ANALYZE UPDATED TABLES
-- =====================================================

ANALYZE providers;
ANALYZE payments;
ANALYZE pricing_plans;
ANALYZE saved_payment_methods;
ANALYZE reviews;
ANALYZE disputes;
ANALYZE admin_actions;
ANALYZE users;
ANALYZE audit_logs;
ANALYZE notification_preferences;
ANALYZE subscriptions;
ANALYZE provider_documents;

-- =====================================================
-- VERIFICATION
-- =====================================================

DO $$
DECLARE
  idx_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO idx_count
  FROM pg_indexes
  WHERE indexname IN (
    'idx_providers_business_name_trgm',
    'idx_providers_response_time_avg',
    'idx_providers_years_experience',
    'idx_providers_service_area_radius',
    'idx_payments_payment_method',
    'idx_pricing_plans_active',
    'idx_saved_payment_methods_expiry_expr',
    'idx_reviews_provider_response',
    'idx_disputes_status_created_at',
    'idx_admin_actions_target',
    'idx_users_email_trgm',
    'idx_audit_logs_brin'
  );

  RAISE NOTICE 'Migration 018: % of 12 key indexes successfully created', idx_count;
END $$;

COMMIT;
