-- Migration 037: Make provider_documents.document_url nullable
--
-- Previously document_url stored the raw Azure Blob URL from the file service.
-- Now we store only file_id (the file service ObjectID) and resolve the URL
-- on-demand via an authenticated API call. New records will have file_id set
-- and document_url = NULL.

INSERT INTO schema_migrations (version, name)
VALUES ('037', 'make_document_url_nullable')
ON CONFLICT (version) DO NOTHING;

ALTER TABLE provider_documents
  ALTER COLUMN document_url DROP NOT NULL;
