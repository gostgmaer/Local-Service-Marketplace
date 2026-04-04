-- Migration tracking table
-- This table records which migrations have been applied to the database.
-- Create this table first if it doesn't exist.

CREATE TABLE IF NOT EXISTS schema_migrations (
  id SERIAL PRIMARY KEY,
  version VARCHAR(255) NOT NULL UNIQUE,
  name VARCHAR(500) NOT NULL,
  applied_at TIMESTAMP DEFAULT now() NOT NULL,
  checksum VARCHAR(64),
  execution_time_ms INTEGER
);

CREATE INDEX IF NOT EXISTS idx_schema_migrations_version ON schema_migrations(version);
