-- Migration 035: Add file_id to provider_documents
-- Stores the external file service ID alongside the document URL,
-- enabling lookups and deletions on the file service side.

ALTER TABLE provider_documents
  ADD COLUMN IF NOT EXISTS file_id TEXT;

CREATE INDEX IF NOT EXISTS idx_provider_documents_file_id
  ON provider_documents(file_id)
  WHERE file_id IS NOT NULL;

