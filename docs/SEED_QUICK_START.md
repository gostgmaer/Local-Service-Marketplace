# 🌱 Quick Start: Database Seeding

## One Command to Populate Everything

```powershell
.\seed-database.ps1
```

That's it! Your database will be populated with 1000+ realistic records.

---

## What Happens

1. ✅ Loads environment variables from `.env`
2. ✅ Checks database connectivity
3. ✅ Installs npm dependencies (if needed)
4. ✅ Seeds all tables with realistic data
5. ✅ Displays summary and login credentials

---

## Login Credentials

**Admin:**
```
Email: admin@marketplace.com
Password: password123
```

**All Users:**
```
Password: password123
```

---

## Data Created

| Category | Count |
|----------|-------|
| Users | 151 |
| Providers | 50 |
| Service Requests | 120+ |
| Proposals | 200+ |
| Jobs | 80+ |
| Payments | 80+ |
| Reviews | 60+ |
| Messages | 400+ |
| Notifications | 300+ |
| **Total Records** | **1000+** |

---

## Requirements

- ✅ PostgreSQL running (`docker-compose up -d postgres-db`)
- ✅ Schema applied (`database/schema.sql`)
- ✅ `.env` file configured

---

## After Seeding

```powershell
# Start your application
.\start.ps1

# Visit
http://localhost:3000

# Login with admin@marketplace.com / password123
```

---

## Need More Info?

📖 See [DATABASE_SEEDING.md](./DATABASE_SEEDING.md) for:
- Detailed table breakdown
- Troubleshooting guide
- Customization options
- Data characteristics

---

## Quick Troubleshooting

**Database not running?**
```powershell
docker-compose up -d postgres-db
```

**Schema not applied?**
```powershell
docker exec -i postgres-db psql -U postgres -d marketplace < database/schema.sql
```

**Need to reset?**
```powershell
docker exec -it postgres-db psql -U postgres -d marketplace -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
docker exec -i postgres-db psql -U postgres -d marketplace < database/schema.sql
.\seed-database.ps1
```

---

**Made with ❤️ for rapid development testing**
