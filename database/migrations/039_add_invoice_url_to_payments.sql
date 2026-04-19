-- Migration 039: Add invoice_url and invoice_file_id to payments
-- Stores the auto-generated invoice file reference after payment completion.

BEGIN;

INSERT INTO schema_migrations (version, name, applied_at)
VALUES ('039', 'add_invoice_url_to_payments', NOW())
ON CONFLICT (version) DO NOTHING;

ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS invoice_url       TEXT,
  ADD COLUMN IF NOT EXISTS invoice_file_id   TEXT;

COMMIT;
