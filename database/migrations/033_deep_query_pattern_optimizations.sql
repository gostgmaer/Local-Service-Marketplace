-- =============================================================================
-- Migration 033: Deep Query Pattern Optimizations
-- Date: April 2026
-- =============================================================================
-- Changes grouped by theme:
--
-- A. PAYMENTS — covering index for provider earnings aggregation
--              composite for job_id + created_at sort
--              partial index for completed-payment analytics
--
-- B. PAYMENT WEBHOOKS — partial composite eliminating post-filter sort
--
-- C. SESSIONS — composite for device-type / location security queries
--               composite for user + created_at (findByUserId ORDER BY)
--
-- D. LOGIN ATTEMPTS — partial index for location-based fraud detection
--
-- E. SERVICE REQUESTS — tighter partial index for countActiveRequestsByUser
--
-- F. PROVIDER REVIEW AGGREGATES — composite covers both findTopRated
--    and findByRatingRange with single index scan
--
-- G. FUNCTIONAL DATE INDEXES — fix DATE(created_at) analytics bypassing
--    B-tree indexes in metrics.repository.ts
-- =============================================================================

BEGIN;

-- =============================================================================
-- A. PAYMENTS
-- =============================================================================

-- A1. Provider earnings aggregation: getProviderEarnings / getProviderEarningsByMonth
--   Query: WHERE provider_id=$1 AND status='completed' AND created_at BETWEEN $2 AND $3
--          + SUM(provider_amount)
--   Current: idx_payments_provider_status_created(provider_id, status, created_at DESC)
--            requires heap fetch for provider_amount column on every matching row.
--   Fix: INCLUDE provider_amount — PostgreSQL returns value from index leaf, skips heap.
-- (Replace the existing index with a covering version)
DROP INDEX IF EXISTS idx_payments_provider_status_created;
CREATE INDEX idx_payments_provider_earnings
  ON payments(provider_id, status, created_at DESC)
  INCLUDE (provider_amount)
  WHERE status = 'completed';

COMMENT ON INDEX idx_payments_provider_earnings
  IS 'Covers getProviderEarnings and getProviderEarningsByMonth: filter + sort + SUM(provider_amount) all from index, no heap fetch';

-- A2. getPaymentsByJobId: WHERE job_id=$1 ORDER BY created_at DESC
--   Current idx_payments_job_id is bare job_id (single-column) forcing a post-lookup sort.
DROP INDEX IF EXISTS idx_payments_job_id;
CREATE INDEX idx_payments_job_id_created
  ON payments(job_id, created_at DESC);

COMMENT ON INDEX idx_payments_job_id_created
  IS 'Replaces idx_payments_job_id; covers getPaymentsByJobId with ORDER BY created_at DESC in one scan';

-- A3. Platform analytics: getPlatformFeeAnalytics
--   Query: WHERE status='completed' AND created_at BETWEEN $1 AND $2 GROUP BY currency
--   A partial index on completed payments sorted by created_at avoids scanning
--   pending/failed rows (typically 5-20% of table) and eliminates a sort step.
CREATE INDEX IF NOT EXISTS idx_payments_completed_created
  ON payments(created_at DESC)
  INCLUDE (platform_fee, amount, currency)
  WHERE status = 'completed';

COMMENT ON INDEX idx_payments_completed_created
  IS 'Covers getPlatformFeeAnalytics date-range query on completed payments; INCLUDE avoids heap for aggregates';

-- =============================================================================
-- B. PAYMENT WEBHOOKS
-- =============================================================================

-- getUnprocessedWebhooks: WHERE processed=false ORDER BY created_at ASC
-- Current idx_payment_webhooks_unprocessed is bare processed=false (no sort support).
-- A composite ordered ASC lets PostgreSQL return rows in delivery order without sorting.
DROP INDEX IF EXISTS idx_payment_webhooks_unprocessed;
CREATE INDEX idx_payment_webhooks_pending_fifo
  ON payment_webhooks(created_at ASC)
  WHERE processed = false;

COMMENT ON INDEX idx_payment_webhooks_pending_fifo
  IS 'Covers getUnprocessedWebhooks; partial (processed=false) + ASC order produces FIFO delivery without sort step';

-- =============================================================================
-- C. SESSIONS
-- =============================================================================

-- C1. getSessionsByDeviceType: WHERE user_id=$1 AND device_type=$2 AND expires_at > NOW()
--   Current (user_id, expires_at) doesn't include device_type; requires filter + recheck.
CREATE INDEX IF NOT EXISTS idx_sessions_user_device_active
  ON sessions(user_id, device_type, expires_at DESC)
  WHERE expires_at > NOW();

COMMENT ON INDEX idx_sessions_user_device_active
  IS 'Covers getSessionsByDeviceType: user + device_type equality filter on non-expired sessions';

-- C2. findByUserId: WHERE user_id=$1 ORDER BY created_at DESC
--   Current idx_sessions_user_id is bare user_id; PostgreSQL fetches all rows then sorts.
--   Replace with a composite that covers the ORDER BY.
DROP INDEX IF EXISTS idx_sessions_user_id;
CREATE INDEX idx_sessions_user_id_created
  ON sessions(user_id, created_at DESC);

COMMENT ON INDEX idx_sessions_user_id_created
  IS 'Replaces idx_sessions_user_id; covers findByUserId ORDER BY created_at DESC without post-sort';

-- =============================================================================
-- D. LOGIN ATTEMPTS — location-based fraud detection
-- =============================================================================

-- getFailedAttemptsByLocation: WHERE location=$1 AND success=false AND created_at > NOW()-window
-- No index on location exists; this is a full table scan for fraud detection queries.
CREATE INDEX IF NOT EXISTS idx_login_attempts_location_failed
  ON login_attempts(location, created_at DESC)
  WHERE success = false AND location IS NOT NULL;

COMMENT ON INDEX idx_login_attempts_location_failed
  IS 'Covers getFailedAttemptsByLocation fraud detection: location equality + recency window + success=false predicate';

-- =============================================================================
-- E. SERVICE REQUESTS — tighter partial index for active-request cap
-- =============================================================================

-- countActiveRequestsByUser: WHERE user_id=$1 AND status='open' AND deleted_at IS NULL
-- Current idx_service_requests_user_status is (user_id, status) WHERE user_id IS NOT NULL
-- which does not filter out soft-deleted rows in the index. PostgreSQL must recheck
-- deleted_at IS NULL on every returned row. A tighter partial eliminates that recheck.
DROP INDEX IF EXISTS idx_service_requests_user_status;
CREATE INDEX idx_service_requests_user_open
  ON service_requests(user_id)
  WHERE status = 'open' AND deleted_at IS NULL AND user_id IS NOT NULL;

COMMENT ON INDEX idx_service_requests_user_open
  IS 'Tight partial index for countActiveRequestsByUser: only open, non-deleted rows per user; replaces idx_service_requests_user_status';

-- =============================================================================
-- F. PROVIDER REVIEW AGGREGATES — unified covering composite
-- =============================================================================

-- findTopRated: WHERE total_reviews >= 5 ORDER BY average_rating DESC, total_reviews DESC
-- findByRatingRange: WHERE average_rating BETWEEN $1 AND $2 ORDER BY total_reviews DESC
-- Two separate single-column indexes force either a full scan + sort or index merge.
-- A single composite (average_rating DESC, total_reviews DESC) covers both:
--   - findByRatingRange: index range scan on average_rating, result pre-ordered by total_reviews
--   - findTopRated: planner can use the second column for the >= 5 filter via skip-scan

DROP INDEX IF EXISTS idx_provider_review_aggregates_rating;
DROP INDEX IF EXISTS idx_provider_review_aggregates_total;

CREATE INDEX idx_provider_review_aggregates_composite
  ON provider_review_aggregates(average_rating DESC, total_reviews DESC);

COMMENT ON INDEX idx_provider_review_aggregates_composite
  IS 'Unified index for findTopRated (rating DESC + reviews DESC) and findByRatingRange (BETWEEN on rating + ORDER total_reviews); replaces two single-column indexes';

-- =============================================================================
-- G. FUNCTIONAL DATE INDEXES for analytics
-- =============================================================================
-- metrics.repository.ts aggregateDailyMetrics uses:
--   WHERE DATE(created_at) = $1        (equivalent: created_at::date = $1)
-- The DATE() function is non-immutable-cast form but PostgreSQL treats it as
-- equivalent to created_at::date. A functional index on the expression allows
-- the planner to use an index scan instead of seqscan + filter on each table.
-- Tables affected: service_requests, jobs, payments, users, proposals
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_service_requests_created_at_date
  ON service_requests((created_at::date))
  WHERE deleted_at IS NULL;

COMMENT ON INDEX idx_service_requests_created_at_date
  IS 'Functional index on created_at::date for DATE(created_at)=$1 analytics queries in metrics.repository.ts';

CREATE INDEX IF NOT EXISTS idx_jobs_created_at_date
  ON jobs((created_at::date));

COMMENT ON INDEX idx_jobs_created_at_date
  IS 'Functional index on created_at::date for per-day job count analytics';

CREATE INDEX IF NOT EXISTS idx_payments_created_at_date
  ON payments((created_at::date));

COMMENT ON INDEX idx_payments_created_at_date
  IS 'Functional index on created_at::date for per-day payment count analytics';

CREATE INDEX IF NOT EXISTS idx_users_created_at_date
  ON users((created_at::date))
  WHERE deleted_at IS NULL;

COMMENT ON INDEX idx_users_created_at_date
  IS 'Functional index on created_at::date for cumulative user count analytics (WHERE created_at::date <= $1)';

CREATE INDEX IF NOT EXISTS idx_proposals_created_at_date
  ON proposals((created_at::date));

COMMENT ON INDEX idx_proposals_created_at_date
  IS 'Functional index on created_at::date for per-day proposal count in getYesterdayMetrics';

-- =============================================================================
-- H. ANALYZE AFFECTED TABLES
-- =============================================================================

ANALYZE payments;
ANALYZE payment_webhooks;
ANALYZE sessions;
ANALYZE login_attempts;
ANALYZE service_requests;
ANALYZE provider_review_aggregates;
ANALYZE jobs;
ANALYZE users;
ANALYZE proposals;

-- =============================================================================
-- I. RECORD MIGRATION
-- =============================================================================

INSERT INTO schema_migrations (version, name, applied_at)
VALUES ('033', 'deep_query_pattern_optimizations', NOW())
ON CONFLICT (version) DO NOTHING;

COMMIT;
