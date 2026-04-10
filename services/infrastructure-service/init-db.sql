-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create events table
CREATE TABLE IF NOT EXISTS events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  display_id VARCHAR(11) UNIQUE NOT NULL,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT now() NOT NULL
);

-- Create indexes for events
CREATE INDEX IF NOT EXISTS idx_events_event_type ON events(event_type);
CREATE INDEX IF NOT EXISTS idx_events_created_at ON events(created_at DESC);

-- Create background_jobs table
CREATE TABLE IF NOT EXISTS background_jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  display_id VARCHAR(11) UNIQUE NOT NULL,
  job_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  attempts INT DEFAULT 0 NOT NULL,
  last_error TEXT,
  created_at TIMESTAMP DEFAULT now() NOT NULL,
  updated_at TIMESTAMP,
  scheduled_for TIMESTAMP DEFAULT now()
);

-- Create indexes for background_jobs
CREATE INDEX IF NOT EXISTS idx_background_jobs_pending ON background_jobs(status) WHERE status != 'completed';
CREATE INDEX IF NOT EXISTS idx_background_jobs_status_scheduled ON background_jobs(status, scheduled_for) WHERE status IN ('pending', 'processing');
CREATE INDEX IF NOT EXISTS idx_background_jobs_type_status ON background_jobs(job_type, status);
CREATE INDEX IF NOT EXISTS idx_background_jobs_attempts ON background_jobs(attempts) WHERE status != 'completed';

-- Create rate_limits table
CREATE TABLE IF NOT EXISTS rate_limits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key TEXT NOT NULL,
  request_count INT NOT NULL,
  window_start TIMESTAMP NOT NULL
);

-- Create indexes for rate_limits
CREATE INDEX IF NOT EXISTS idx_rate_limits_key ON rate_limits(key);
CREATE INDEX IF NOT EXISTS idx_rate_limits_window_start ON rate_limits(window_start);
CREATE INDEX IF NOT EXISTS idx_rate_limits_key_window ON rate_limits(key, window_start DESC);

-- Create feature_flags table
CREATE TABLE IF NOT EXISTS feature_flags (
  key TEXT PRIMARY KEY,
  enabled BOOLEAN NOT NULL,
  rollout_percentage INT DEFAULT 100 NOT NULL CHECK (rollout_percentage >= 0 AND rollout_percentage <= 100)
);

-- Note: These tables are centralized in database/schema.sql 
-- but provided here for local service consistency and testing.
