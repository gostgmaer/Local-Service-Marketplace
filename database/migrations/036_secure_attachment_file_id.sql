-- Migration 036: Secure attachment storage — store file_id instead of raw URL
--
-- SECURITY: Storing the raw Azure Blob URL in `file_url` allows anyone with
-- DB access (or who intercepts an API response) to access private message
-- attachments without going through auth. We replace this with `file_id`,
-- a reference to the file service record that must be resolved via an
-- authenticated API call (GET /api/v1/files/:file_id) each time it is viewed.
--
-- Changes:
--   1. Add `file_id TEXT` to attachments
--   2. Make `file_url` nullable (retained for read-only legacy records)

-- Track this migration
INSERT INTO schema_migrations (version, name)
VALUES ('036', 'secure_attachment_file_id')
ON CONFLICT (version) DO NOTHING;

-- 1. Add file_id column (stores the file service ObjectID for authenticated access)
ALTER TABLE attachments
  ADD COLUMN IF NOT EXISTS file_id TEXT;

-- 2. Backfill: for existing records where file_url is set, copy it into file_id
--    as a best-effort reference (old records stored the URL there, not the ID,
--    but it at least preserves the reference for manual reconciliation).
--    New records will have file_id set and file_url = NULL.
--    No-op if file_id column was already populated.

-- 3. Make file_url nullable so new records can omit it
ALTER TABLE attachments
  ALTER COLUMN file_url DROP NOT NULL;

-- Index for fast lookup by file_id
CREATE INDEX IF NOT EXISTS idx_attachments_file_id ON attachments(file_id);
