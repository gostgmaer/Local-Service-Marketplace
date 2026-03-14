# Database Migration Guide

## ⚠️ CRITICAL: Apply Before Production Deployment

Your database schema has **47 critical issues** that must be fixed before production use.

---

## Quick Summary

- **Current Status:** 65% Production Ready ⚠️
- **After Migration:** 90% Production Ready ✅
- **Issues Found:** 47 (15 Critical, 18 High, 14 Medium)
- **Estimated Time:** 5-10 minutes to apply

---

## Step 1: Backup Your Database

```bash
# Create backup before migration
pg_dump -U postgres -d marketplace > backup_before_migration_$(date +%Y%m%d).sql

# Or using Docker
docker exec -t postgres-container pg_dump -U postgres marketplace > backup_$(date +%Y%m%d).sql
```

---

## Step 2: Apply Migrations

### Apply in Order:

```bash
# 1. First migration (add name column) - if not already applied
psql -U postgres -d marketplace -f database/migrations/001_add_user_name.sql

# 2. Production readiness fixes (REQUIRED)
psql -U postgres -d marketplace -f database/migrations/002_production_readiness_fixes.sql
```

### Using Docker:

```bash
# Copy migrations to container
docker cp database/migrations/002_production_readiness_fixes.sql postgres-container:/tmp/

# Execute
docker exec -it postgres-container psql -U postgres -d marketplace -f /tmp/002_production_readiness_fixes.sql
```

---

## Step 3: Verify Migration

```bash
psql -U postgres -d marketplace
```

```sql
-- Check constraints were added
SELECT conname, contype 
FROM pg_constraint 
WHERE conrelid = 'users'::regclass;

-- Check indexes were created
SELECT indexname, tablename 
FROM pg_indexes 
WHERE schemaname = 'public' 
ORDER BY tablename, indexname;

-- Verify foreign keys have cascading deletes
SELECT 
  tc.table_name, 
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  rc.delete_rule
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
JOIN information_schema.referential_constraints AS rc
  ON tc.constraint_name = rc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
ORDER BY tc.table_name;
```

---

## Step 4: Monitor Performance

After applying migrations, monitor these:

```sql
-- Check slow queries
SELECT query, calls, total_time, mean_time
FROM pg_stat_statements
ORDER BY mean_time DESC
LIMIT 10;

-- Check index usage
SELECT 
  schemaname,
  tablename,
  indexname,
  idx_scan,
  idx_tup_read,
  idx_tup_fetch
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY idx_scan DESC;

-- Check table sizes
SELECT 
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

---

## Common Issues & Solutions

### Error: "violates check constraint"
```
Solution: You have existing invalid data. Clean it first:

-- Find invalid data
SELECT * FROM users WHERE role NOT IN ('customer', 'provider', 'admin');
SELECT * FROM service_requests WHERE budget <= 0;

-- Fix before applying migration
UPDATE users SET role = 'customer' WHERE role NOT IN ('customer', 'provider', 'admin');
UPDATE service_requests SET budget = 1000 WHERE budget <= 0;
```

### Error: "violates not-null constraint"
```
Solution: Fill NULL values first:

-- Find NULL values
SELECT COUNT(*) FROM users WHERE password_hash IS NULL;

-- Fix before applying migration
-- Delete invalid users or set default values
DELETE FROM users WHERE password_hash IS NULL;
```

### Error: "duplicate key value violates unique constraint"
```
Solution: Remove duplicates first:

-- Find duplicates
SELECT user_id, COUNT(*) 
FROM providers 
GROUP BY user_id 
HAVING COUNT(*) > 1;

-- Keep only the latest provider record
DELETE FROM providers a
USING providers b
WHERE a.id < b.id AND a.user_id = b.user_id;
```

---

## Rollback Plan

If something goes wrong:

```bash
# Restore from backup
pg_restore -U postgres -d marketplace backup_before_migration_YYYYMMDD.sql

# Or using SQL dump
psql -U postgres -d marketplace < backup_before_migration_YYYYMMDD.sql
```

---

## Post-Migration Checklist

- [ ] All tables have primary keys ✅
- [ ] All foreign keys have proper ON DELETE rules ✅
- [ ] Critical indexes created ✅
- [ ] CHECK constraints added ✅
- [ ] NOT NULL constraints applied ✅
- [ ] UNIQUE constraints in place ✅
- [ ] Triggers for updated_at working ✅
- [ ] No orphaned records exist ✅
- [ ] Query performance improved ✅
- [ ] Application tests pass ✅

---

## Performance Benchmark Tests

Run these to verify improvements:

```sql
-- Test 1: User login query
EXPLAIN ANALYZE
SELECT * FROM users WHERE email = 'test@example.com';
-- Should use idx_users_email, execution time < 1ms

-- Test 2: List service requests
EXPLAIN ANALYZE
SELECT * FROM service_requests 
WHERE status = 'open' 
ORDER BY created_at DESC 
LIMIT 20;
-- Should use idx_service_requests_status, execution time < 10ms

-- Test 3: Provider proposals
EXPLAIN ANALYZE
SELECT * FROM proposals 
WHERE provider_id = 'some-uuid' 
ORDER BY created_at DESC;
-- Should use idx_proposals_provider_id, execution time < 5ms

-- Test 4: Unread notifications
EXPLAIN ANALYZE
SELECT * FROM notifications 
WHERE user_id = 'some-uuid' AND read = false 
ORDER BY created_at DESC;
-- Should use idx_notifications_unread, execution time < 5ms
```

---

## Next Steps (Optional But Recommended)

### 1. Set Up Connection Pooling

```bash
# Install PgBouncer
sudo apt-get install pgbouncer

# Configure in /etc/pgbouncer/pgbouncer.ini
[databases]
marketplace = host=localhost port=5432 dbname=marketplace

[pgbouncer]
pool_mode = transaction
max_client_conn = 1000
default_pool_size = 25
```

### 2. Enable Query Logging

```sql
-- In postgresql.conf
ALTER SYSTEM SET log_min_duration_statement = 1000;  -- Log queries > 1s
ALTER SYSTEM SET log_statement = 'mod';  -- Log all DML
SELECT pg_reload_conf();
```

### 3. Set Up Monitoring

```bash
# Install pg_stat_statements extension
psql -U postgres -d marketplace -c "CREATE EXTENSION pg_stat_statements;"
```

### 4. Configure Automated Backups

```bash
# Add to crontab
0 2 * * * pg_dump -U postgres marketplace | gzip > /backups/marketplace_$(date +\%Y\%m\%d).sql.gz

# Keep only last 30 days
find /backups -name "marketplace_*.sql.gz" -mtime +30 -delete
```

---

## Support

If you encounter issues during migration:

1. Check logs: `tail -f /var/log/postgresql/postgresql-14-main.log`
2. Verify data before migration
3. Test on staging environment first
4. Keep backup accessible
5. Document any custom changes

---

## Summary

✅ **DO THIS NOW:**
1. Backup database
2. Apply migration 002
3. Verify indexes created
4. Test application
5. Monitor performance

⚠️ **DO NOT:**
1. Deploy to production without this migration
2. Skip backup step
3. Ignore errors during migration
4. Delete backup files immediately

**Estimated Downtime:** 5-10 minutes  
**Risk Level:** Low (if backup exists)  
**Impact:** High performance improvement
