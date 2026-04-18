-- Migration 034: Review soft-delete + dispute window index
-- Addresses business flow gaps:
--   1. Hard-delete on reviews enables rating manipulation (delete bad review,
--      submit new one). Soft-delete keeps the audit trail.
--   2. No index on jobs.completed_at made dispute-window queries expensive.

-- ─── 1. Add deleted_at column to reviews ───────────────────────────────────
ALTER TABLE reviews
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP DEFAULT NULL;

-- Index so "live reviews" queries skip tombstoned rows quickly
CREATE INDEX IF NOT EXISTS idx_reviews_not_deleted
  ON reviews (provider_id, created_at DESC)
  WHERE deleted_at IS NULL;

-- ─── 2. Add index on jobs.completed_at for dispute & review window checks ──
CREATE INDEX IF NOT EXISTS idx_jobs_completed_at
  ON jobs (completed_at DESC)
  WHERE completed_at IS NOT NULL;
