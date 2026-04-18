-- =============================================================================
-- Migration 032: Index Optimizations — Gaps, Composites & Autovacuum Tuning
-- Date: April 2026
-- =============================================================================
-- Changes:
--   ADD   conversations(customer_id, last_message_at DESC) — inbox sort coverage
--   ADD   conversations(provider_id, last_message_at DESC) — provider inbox sort
--   ADD   refunds(created_at DESC)                         — admin unfiltered list
--   DROP  refunds(payment_id) single-column, REPLACE with (payment_id, created_at DESC)
--   DROP  admin_actions(admin_id) single-column, REPLACE with (admin_id, created_at DESC)
--   ADD   user_devices(user_id, last_seen DESC)            — recent devices per user
--   DROP  idx_proposals_status  — redundant; superseded by idx_proposals_status_created_at
--   DROP  idx_jobs_status        — redundant; superseded by idx_jobs_status_started_at
--   DROP  idx_payments_status    — redundant; superseded by idx_payments_status_created
--   DROP  idx_disputes_status    — redundant; superseded by idx_disputes_status_created_at
--   TUNE  autovacuum on login_history, user_activity_logs, notifications, events
--   TUNE  statistics targets for notifications.type and notifications.read
-- =============================================================================

BEGIN;

-- =============================================================================
-- 1. CONVERSATIONS — composite indexes to cover getUserConversations ORDER BY
-- =============================================================================
-- Query pattern (message.repository.ts getUserConversations):
--   WHERE c.customer_id = $1 OR c.provider_id = $1
--   ORDER BY c.last_message_at DESC NULLS LAST
-- PostgreSQL can merge two composite index scans (one per condition) and
-- produce the result in sorted order, eliminating the Incremental Sort step.
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_conversations_customer_last_msg
  ON conversations(customer_id, last_message_at DESC NULLS LAST);

COMMENT ON INDEX idx_conversations_customer_last_msg
  IS 'getUserConversations: customer-side OR branch, pre-sorted by last message time';

CREATE INDEX IF NOT EXISTS idx_conversations_provider_last_msg
  ON conversations(provider_id, last_message_at DESC NULLS LAST);

COMMENT ON INDEX idx_conversations_provider_last_msg
  IS 'getUserConversations: provider-side OR branch, pre-sorted by last message time';

-- =============================================================================
-- 2. REFUNDS — created_at sort index + composite to cover getRefundsByPaymentId
-- =============================================================================
-- Query patterns (refund.repository.ts):
--   getAllRefunds:         SELECT * FROM refunds ORDER BY created_at DESC
--   getRefundsByPaymentId: WHERE payment_id = $1 ORDER BY created_at DESC
-- =============================================================================

-- Admin unfiltered listing — needs a plain created_at index for seq-to-sort reduction
CREATE INDEX IF NOT EXISTS idx_refunds_created_at
  ON refunds(created_at DESC);

COMMENT ON INDEX idx_refunds_created_at
  IS 'Covers getAllRefunds ORDER BY created_at DESC without seq scan';

-- Replace single-column payment_id with composite covering the ORDER BY
-- (payment_id alone cannot eliminate the sort for getRefundsByPaymentId)
DROP INDEX IF EXISTS idx_refunds_payment_id;

CREATE INDEX IF NOT EXISTS idx_refunds_payment_id_created
  ON refunds(payment_id, created_at DESC);

COMMENT ON INDEX idx_refunds_payment_id_created
  IS 'Replaces idx_refunds_payment_id; covers getRefundsByPaymentId with ORDER BY created_at DESC in a single index scan';

-- =============================================================================
-- 3. ADMIN ACTIONS — composite (admin_id, created_at DESC)
-- =============================================================================
-- Query pattern (admin-action.repository.ts getAdminActionsByAdminId):
--   WHERE admin_id = $1 ORDER BY created_at DESC
-- Two separate single-column indexes force a lookup + sort; one composite
-- covers both in a single ordered index scan.
-- =============================================================================

DROP INDEX IF EXISTS idx_admin_actions_admin_id;

CREATE INDEX IF NOT EXISTS idx_admin_actions_admin_id_created
  ON admin_actions(admin_id, created_at DESC);

COMMENT ON INDEX idx_admin_actions_admin_id_created
  IS 'Replaces idx_admin_actions_admin_id; covers getAdminActionsByAdminId with ORDER BY created_at DESC';

-- =============================================================================
-- 4. USER DEVICES — composite (user_id, last_seen DESC)
-- =============================================================================
-- Query pattern for security settings "recent login devices":
--   WHERE user_id = $1 ORDER BY last_seen DESC
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_user_devices_user_last_seen
  ON user_devices(user_id, last_seen DESC NULLS LAST);

COMMENT ON INDEX idx_user_devices_user_last_seen
  IS 'Recent-devices security view: filter by user, sort by last_seen DESC';

-- =============================================================================
-- 5. DROP REDUNDANT SINGLE-COLUMN STATUS INDEXES
-- =============================================================================
-- Each of these is superseded by an existing composite index where status is
-- the leading column. PostgreSQL can use the leading column of a (status, X)
-- index for all equality predicates on status alone, so these single-column
-- indexes add write overhead on every INSERT/UPDATE with zero query benefit.
--
--   idx_proposals_status   → superseded by idx_proposals_status_created_at
--   idx_jobs_status        → superseded by idx_jobs_status_started_at
--   idx_payments_status    → superseded by idx_payments_status_created
--   idx_disputes_status    → superseded by idx_disputes_status_created_at
-- =============================================================================

DROP INDEX IF EXISTS idx_proposals_status;
DROP INDEX IF EXISTS idx_jobs_status;
DROP INDEX IF EXISTS idx_payments_status;
DROP INDEX IF EXISTS idx_disputes_status;

-- =============================================================================
-- 6. AUTOVACUUM TUNING FOR HIGH-VOLUME TABLES
-- =============================================================================
-- These tables receive high INSERT rates but were not included in the
-- autovacuum tuning block in schema.sql, leaving them at PostgreSQL's
-- conservative defaults (scale_factor=0.2, analyze_scale_factor=0.1).
-- Tighter thresholds keep table bloat low and statistics fresh.
-- =============================================================================

-- login_history: every successful/failed login writes a row
ALTER TABLE login_history SET (
  autovacuum_vacuum_scale_factor   = 0.05,
  autovacuum_analyze_scale_factor  = 0.02
);

-- user_activity_logs: every user action writes a row
ALTER TABLE user_activity_logs SET (
  autovacuum_vacuum_scale_factor   = 0.05,
  autovacuum_analyze_scale_factor  = 0.02
);

-- notifications: every email/push event writes a row (BullMQ workers)
ALTER TABLE notifications SET (
  autovacuum_vacuum_scale_factor   = 0.05,
  autovacuum_analyze_scale_factor  = 0.02
);

-- events: append-only Kafka event store — higher threshold is OK, but still
-- needs more frequent analyze to keep planner cardinality estimates accurate
ALTER TABLE events SET (
  autovacuum_vacuum_scale_factor   = 0.1,
  autovacuum_analyze_scale_factor  = 0.05
);

-- =============================================================================
-- 7. STATISTICS TARGETS FOR PLANNER CARDINALITY
-- =============================================================================
-- notifications.type and .read are used in WHERE clauses but have few distinct
-- values; raising statistics gives the planner better row-count estimates for
-- Bitmap Index Scan vs Sequential Scan decisions.
-- =============================================================================

ALTER TABLE notifications ALTER COLUMN type SET STATISTICS 500;
ALTER TABLE notifications ALTER COLUMN read SET STATISTICS 200;

-- =============================================================================
-- 8. ANALYZE AFFECTED TABLES
-- =============================================================================

ANALYZE conversations;
ANALYZE refunds;
ANALYZE admin_actions;
ANALYZE user_devices;
ANALYZE proposals;
ANALYZE jobs;
ANALYZE payments;
ANALYZE disputes;
ANALYZE notifications;
ANALYZE login_history;
ANALYZE user_activity_logs;
ANALYZE events;

-- =============================================================================
-- 9. RECORD MIGRATION
-- =============================================================================

INSERT INTO schema_migrations (version, name, applied_at)
VALUES ('032', 'index_optimizations', NOW())
ON CONFLICT (version) DO NOTHING;

COMMIT;
