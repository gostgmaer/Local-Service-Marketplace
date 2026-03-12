-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create jobs table
CREATE TABLE IF NOT EXISTS jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  request_id UUID NOT NULL,
  provider_id UUID NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_jobs_request_id ON jobs(request_id);
CREATE INDEX IF NOT EXISTS idx_jobs_provider_id ON jobs(provider_id);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_started_at ON jobs(started_at);

-- Create unique constraint to prevent duplicate jobs for same request
CREATE UNIQUE INDEX IF NOT EXISTS idx_jobs_request_unique ON jobs(request_id);
