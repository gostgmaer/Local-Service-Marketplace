-- Migration 045: Dispute escalated status + dispute_messages table
-- Fixes:
--   1. Adds 'escalated' to disputes.status CHECK constraint so the daily
--      escalation worker can set it without a constraint violation.
--   2. Ensures description and evidence_images columns exist (idempotent
--      guard in case migrations 041 / 043 were not applied to this DB).
--   3. Creates dispute_messages table for the threaded investigation chat.

-- ── 1. Ensure description column exists ───────────────────────────────────
ALTER TABLE disputes
  ADD COLUMN IF NOT EXISTS description TEXT;

-- ── 2. Ensure evidence_images column exists ────────────────────────────────
ALTER TABLE disputes
  ADD COLUMN IF NOT EXISTS evidence_images JSONB NOT NULL DEFAULT '[]'::jsonb;

-- ── 3. Widen disputes.status CHECK to include 'escalated' ─────────────────
-- PostgreSQL does not support ALTER CONSTRAINT for CHECK constraints, so we
-- must drop the old one and add the new one.
ALTER TABLE disputes
  DROP CONSTRAINT IF EXISTS disputes_status_check;

ALTER TABLE disputes
  ADD CONSTRAINT disputes_status_check
  CHECK (status IN ('open', 'investigating', 'escalated', 'resolved', 'closed'));

-- ── 4. Create dispute_messages table ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS dispute_messages (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  dispute_id   UUID NOT NULL REFERENCES disputes(id) ON DELETE CASCADE,
  sender_id    UUID REFERENCES users(id) ON DELETE SET NULL,
  message      TEXT NOT NULL,
  images       JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_admin     BOOLEAN NOT NULL DEFAULT FALSE,
  created_at   TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE dispute_messages IS
  'Threaded messages for a dispute investigation. '
  'Accessible by both job parties and admin.';

COMMENT ON COLUMN dispute_messages.images IS
  'Array of { id: uuid, url: string } — additional evidence images sent with the message.';

COMMENT ON COLUMN dispute_messages.is_admin IS
  'TRUE when the sender is an admin user — used to visually distinguish admin replies.';

CREATE INDEX IF NOT EXISTS idx_dispute_messages_dispute_id
  ON dispute_messages(dispute_id, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_dispute_messages_sender_id
  ON dispute_messages(sender_id);
