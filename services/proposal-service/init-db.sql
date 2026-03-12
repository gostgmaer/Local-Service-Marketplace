-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create proposals table
CREATE TABLE IF NOT EXISTS proposals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  request_id UUID NOT NULL,
  provider_id UUID NOT NULL,
  price INT NOT NULL,
  message TEXT NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_proposals_request_id ON proposals(request_id);
CREATE INDEX IF NOT EXISTS idx_proposals_provider_id ON proposals(provider_id);
CREATE INDEX IF NOT EXISTS idx_proposals_status ON proposals(status);
CREATE INDEX IF NOT EXISTS idx_proposals_created_at ON proposals(created_at);

-- Create unique constraint to prevent duplicate proposals from same provider for same request
CREATE UNIQUE INDEX IF NOT EXISTS idx_proposals_request_provider_unique 
  ON proposals(request_id, provider_id);
