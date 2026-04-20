-- Migration 040: Change money columns from BIGINT to NUMERIC(12,2)
-- Fixes: "invalid input syntax for type bigint" when inserting decimal amounts
-- (e.g. GST-inclusive totals like 6346.86)

BEGIN;

-- Drop materialized views that depend on the columns being altered
DROP MATERIALIZED VIEW IF EXISTS provider_stats CASCADE;
DROP MATERIALIZED VIEW IF EXISTS service_request_stats CASCADE;

-- payments table
ALTER TABLE payments
  ALTER COLUMN amount        TYPE NUMERIC(12,2) USING amount::NUMERIC(12,2),
  ALTER COLUMN platform_fee  TYPE NUMERIC(12,2) USING platform_fee::NUMERIC(12,2),
  ALTER COLUMN provider_amount TYPE NUMERIC(12,2) USING provider_amount::NUMERIC(12,2);

-- jobs table
ALTER TABLE jobs
  ALTER COLUMN actual_amount TYPE NUMERIC(12,2) USING actual_amount::NUMERIC(12,2);

-- service_requests table
ALTER TABLE service_requests
  ALTER COLUMN budget TYPE NUMERIC(12,2) USING budget::NUMERIC(12,2);

-- proposals table
ALTER TABLE proposals
  ALTER COLUMN price TYPE NUMERIC(12,2) USING price::NUMERIC(12,2);

-- Recreate materialized views
CREATE MATERIALIZED VIEW provider_stats AS
SELECT 
  p.id AS provider_id,
  p.business_name,
  COUNT(DISTINCT j.id) AS total_jobs,
  COUNT(DISTINCT CASE WHEN j.status = 'completed' THEN j.id END) AS completed_jobs,
  COALESCE(AVG(r.rating), 0) AS average_rating,
  COUNT(DISTINCT r.id) AS total_reviews,
  SUM(pay.amount) AS total_earnings
FROM providers p
LEFT JOIN jobs j ON j.provider_id = p.id
LEFT JOIN reviews r ON r.provider_id = p.id
LEFT JOIN payments pay ON pay.job_id = j.id AND pay.status = 'completed'
WHERE p.deleted_at IS NULL
GROUP BY p.id, p.business_name;

CREATE UNIQUE INDEX idx_provider_stats_provider_id ON provider_stats(provider_id);

CREATE MATERIALIZED VIEW service_request_stats AS
SELECT 
  DATE_TRUNC('day', created_at) AS date,
  category_id,
  COUNT(*) AS request_count,
  COUNT(DISTINCT user_id) AS unique_users,
  AVG(budget) AS avg_budget
FROM service_requests
WHERE deleted_at IS NULL
GROUP BY DATE_TRUNC('day', created_at), category_id;

CREATE UNIQUE INDEX idx_service_request_stats_unique ON service_request_stats(date, category_id);
CREATE INDEX idx_service_request_stats_date ON service_request_stats(date DESC);
CREATE INDEX idx_service_request_stats_category ON service_request_stats(category_id);

-- Record migration
INSERT INTO schema_migrations (version, name)
VALUES (40, '040_fix_money_column_types')
ON CONFLICT DO NOTHING;

COMMIT;
