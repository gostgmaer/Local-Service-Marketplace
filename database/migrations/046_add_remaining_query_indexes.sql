-- Migration: add remaining query indexes
-- Version: 046
-- Date: 2026-05-01
-- Description: Adds composite/partial indexes for queue and list query patterns found in repository audit.

-- UP: Apply migration

CREATE INDEX IF NOT EXISTS idx_notification_deliveries_status_created_at
  ON notification_deliveries(status, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_notification_deliveries_notification_created_at
  ON notification_deliveries(notification_id, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_attachments_message_created_at
  ON attachments(message_id, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_user_activity_user_created_at
  ON user_activity_logs(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_provider_documents_unverified_created_at
  ON provider_documents(created_at ASC)
  WHERE verified = false;

CREATE INDEX IF NOT EXISTS idx_disputes_open_investigating_updated_at
  ON disputes(updated_at ASC)
  WHERE status IN ('open', 'investigating');

CREATE INDEX IF NOT EXISTS idx_coupon_usage_user_used_at
  ON coupon_usage(user_id, used_at DESC);

CREATE INDEX IF NOT EXISTS idx_messages_job_edited_at
  ON messages(job_id, edited_at DESC)
  WHERE edited = true;


-- DOWN
-- Rollback migration

DROP INDEX IF EXISTS idx_messages_job_edited_at;
DROP INDEX IF EXISTS idx_coupon_usage_user_used_at;
DROP INDEX IF EXISTS idx_disputes_open_investigating_updated_at;
DROP INDEX IF EXISTS idx_provider_documents_unverified_created_at;
DROP INDEX IF EXISTS idx_user_activity_user_created_at;
DROP INDEX IF EXISTS idx_attachments_message_created_at;
DROP INDEX IF EXISTS idx_notification_deliveries_notification_created_at;
DROP INDEX IF EXISTS idx_notification_deliveries_status_created_at;
