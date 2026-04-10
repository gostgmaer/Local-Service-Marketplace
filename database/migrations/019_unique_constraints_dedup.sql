-- =====================================================
-- UNIQUE CONSTRAINTS — Duplicate Data Prevention
-- Date: April 10, 2026
-- Purpose: Enforce DB-level uniqueness for two tables
--          that had race-condition duplicate risks.
--
-- coupon_usage: check-then-insert race → same user
--   could redeem the same coupon twice simultaneously.
--   Fix: UNIQUE(coupon_id, user_id) + ON CONFLICT in repo.
--
-- rate_limits: check-then-insert race → two concurrent
--   requests for the same key both see no row and both
--   INSERT, producing duplicate key rows.
--   Fix: UNIQUE(key) + ON CONFLICT DO UPDATE in repo.
-- =====================================================

BEGIN;

-- =====================================================
-- 1. COUPON USAGE — one redemption per user per coupon
-- =====================================================

-- Remove any existing duplicates (keep earliest usage per pair)
DELETE FROM coupon_usage cu
WHERE cu.id NOT IN (
  SELECT DISTINCT ON (coupon_id, user_id) id
  FROM coupon_usage
  ORDER BY coupon_id, user_id, used_at ASC
);

-- Add the unique constraint
CREATE UNIQUE INDEX IF NOT EXISTS idx_coupon_usage_unique
  ON coupon_usage(coupon_id, user_id);

COMMENT ON INDEX idx_coupon_usage_unique
  IS 'Prevents a user from redeeming the same coupon more than once at the DB level';

-- =====================================================
-- 2. RATE LIMITS — one row per key
-- =====================================================

-- Remove any existing duplicates (keep the row with highest request_count)
DELETE FROM rate_limits rl
WHERE rl.id NOT IN (
  SELECT DISTINCT ON (key) id
  FROM rate_limits
  ORDER BY key, request_count DESC
);

-- Add the unique constraint (replaces the non-unique idx_rate_limits_key)
DROP INDEX IF EXISTS idx_rate_limits_key;
CREATE UNIQUE INDEX IF NOT EXISTS idx_rate_limits_key_unique
  ON rate_limits(key);

COMMENT ON INDEX idx_rate_limits_key_unique
  IS 'Enforces one rate-limit row per key; enables ON CONFLICT upsert in the repository';

-- =====================================================
-- VERIFICATION
-- =====================================================

DO $$
DECLARE
  coupon_dups  INTEGER;
  rate_dups    INTEGER;
BEGIN
  SELECT COUNT(*) INTO coupon_dups
  FROM (
    SELECT coupon_id, user_id, COUNT(*) AS c
    FROM coupon_usage
    GROUP BY coupon_id, user_id
    HAVING COUNT(*) > 1
  ) sub;

  SELECT COUNT(*) INTO rate_dups
  FROM (
    SELECT key, COUNT(*) AS c
    FROM rate_limits
    GROUP BY key
    HAVING COUNT(*) > 1
  ) sub;

  IF coupon_dups > 0 THEN
    RAISE EXCEPTION 'Duplicate coupon_usage rows still exist after cleanup: %', coupon_dups;
  END IF;

  IF rate_dups > 0 THEN
    RAISE EXCEPTION 'Duplicate rate_limits rows still exist after cleanup: %', rate_dups;
  END IF;

  RAISE NOTICE 'Migration 019: All uniqueness constraints applied and verified.';
END $$;

COMMIT;
