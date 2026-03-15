# 🎯 Database Seeding - Quick Reference Card

## ⚡ One-Line Command

```powershell
.\seed-database.ps1
```

---

## 📊 What You Get

| Category | Count |
|----------|-------|
| 👥 Users | 151 (100 customers + 50 providers + 1 admin) |
| 🏢 Providers | 50 with full profiles |
| 📁 Service Categories | 15 |
| 📝 Service Requests | 120+ |
| 💼 Proposals | 200+ |
| 👷 Jobs | 80+ |
| 💳 Payments | 80+ |
| ⭐ Reviews | 60+ |
| 💬 Messages | 400+ |
| 🔔 Notifications | 300+ |
| **TOTAL** | **1000+** |

---

## 🔑 Login Credentials

```
Admin:
  Email: admin@marketplace.com
  Password: password123

All Users:
  Password: password123
```

---

## 📋 Prerequisites Checklist

- [ ] PostgreSQL running (`docker-compose up -d postgres-db`)
- [ ] Schema applied (`database/schema.sql`)
- [ ] `.env` file configured

---

## 🚀 Quick Start

```powershell
# 1. Start database
docker-compose up -d postgres-db

# 2. Apply schema (first time only)
docker exec -i postgres-db psql -U postgres -d marketplace < database/schema.sql

# 3. Run seeder
.\seed-database.ps1

# 4. Start application
.\start.ps1

# 5. Open browser
http://localhost:3000
```

---

## 🔄 Reset & Re-seed

```powershell
# Drop all data
docker exec -it postgres-db psql -U postgres -d marketplace -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"

# Reapply schema
docker exec -i postgres-db psql -U postgres -d marketplace < database/schema.sql

# Re-seed
.\seed-database.ps1
```

---

## 📖 Documentation

| Quick | Detailed |
|-------|----------|
| [SEED_QUICK_START.md](./SEED_QUICK_START.md) | [DATABASE_SEEDING.md](./DATABASE_SEEDING.md) |
|  | [DATABASE_SEEDING_SUMMARY.md](./DATABASE_SEEDING_SUMMARY.md) |
|  | [database/README.md](./database/README.md) |

---

## ⚠️ Important Notes

- ✅ Safe for development/testing
- ❌ **NEVER** run in production
- ✅ Fully reversible
- ❌ All passwords are `password123`
- ✅ Realistic data with proper relationships

---

## 🛠️ Troubleshooting

| Issue | Solution |
|-------|----------|
| Database connection failed | `docker-compose up -d postgres-db` |
| Table does not exist | Apply schema: `docker exec -i postgres-db psql -U postgres -d marketplace < database/schema.sql` |
| Duplicate key error | Clear database first (see "Reset & Re-seed" above) |
| Dependencies not found | `cd database; pnpm install` |

---

## ✅ Verification

```sql
-- Connect to database
docker exec -it postgres-db psql -U postgres -d marketplace

-- Check record counts
SELECT 'users' as table_name, COUNT(*) FROM users
UNION ALL SELECT 'providers', COUNT(*) FROM providers
UNION ALL SELECT 'service_requests', COUNT(*) FROM service_requests
UNION ALL SELECT 'jobs', COUNT(*) FROM jobs;
```

Expected output:
```
 table_name       | count
------------------+-------
 users            |   151
 providers        |    50
 service_requests |   120+
 jobs             |    80+
```

---

## 📞 Support

**Database logs:**
```powershell
docker logs postgres-db
```

**Verify environment:**
```powershell
.\verify-env.ps1
```

**Check database status:**
```powershell
docker ps | findstr postgres
docker exec postgres-db pg_isready -U postgres
```

---

**🚀 Happy Testing!**
