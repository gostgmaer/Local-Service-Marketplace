-- Migration 043: Add evidence_images column to disputes table
-- Stores an array of { id, url } objects uploaded as evidence when filing a dispute.

ALTER TABLE disputes
  ADD COLUMN IF NOT EXISTS evidence_images JSONB NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN disputes.evidence_images IS
  'Array of { id: uuid, url: string } objects — evidence photos uploaded by the claimant';
