# Environment Files - Quick Reference

## ✅ All Environment Files Fixed and Verified

### Scripts Created

1. **setup-env-files.ps1** - Automatically creates .env files from .env.example
2. **verify-env-vars.ps1** - Verifies all environment variables are properly configured

### Files Updated

#### API Gateway
- ✅ `api-gateway/.env` - Added GATEWAY_INTERNAL_SECRET, TOKEN_VALIDATION_STRATEGY, Redis config
- ✅ `api-gateway/.env.example` - Updated to match .env with all new variables

#### Auth Service
- ✅ `services/auth-service/.env` - Added GATEWAY_INTERNAL_SECRET, fixed JWT_SECRET to match gateway
- ✅ `services/auth-service/.env.example` - Updated to match .env

#### Root Directory
- ✅ `.env.example` - Added GATEWAY_INTERNAL_SECRET, TOKEN_VALIDATION_STRATEGY, JWT_REFRESH_SECRET

#### Frontend
- ✅ `frontend/nextjs-app/.env` - Created from .env.example

### Key Environment Variables

#### Must Match Between Services
```env
# MUST be identical in api-gateway and auth-service
JWT_SECRET=your-super-secret-jwt-key-change-in-production
GATEWAY_INTERNAL_SECRET=gateway-internal-secret-change-in-production
```

#### New Variables Added
```env
# Token validation strategy (api-gateway only)
TOKEN_VALIDATION_STRATEGY=local   # or 'api'

# Gateway internal secret (api-gateway and auth-service)
GATEWAY_INTERNAL_SECRET=gateway-internal-secret-change-in-production

# Refresh token secret (auth-service only)
JWT_REFRESH_SECRET=your-super-secret-refresh-jwt-key-change-in-production
```

### Quick Setup Guide

#### 1. Setup Environment Files
```powershell
.\setup-env-files.ps1
```

#### 2. Verify Configuration
```powershell
.\verify-env-vars.ps1
```

#### 3. Generate Production Secrets
```bash
# Generate JWT_SECRET
openssl rand -base64 48

# Generate JWT_REFRESH_SECRET
openssl rand -base64 48

# Generate GATEWAY_INTERNAL_SECRET
openssl rand -base64 48
```

#### 4. Update Critical Values
Edit these files and replace placeholder values:
- `api-gateway/.env`
- `services/auth-service/.env`
- `.env` (root, for Docker Compose)

### Verification Status

✅ All .env files created/updated  
✅ JWT_SECRET matches between services  
✅ GATEWAY_INTERNAL_SECRET matches between services  
✅ All required variables present  
⚠️ Placeholder values present (expected - change in production)  

### Documentation

- 📖 [Complete Environment Variables Guide](docs/ENVIRONMENT_VARIABLES_GUIDE.md)
- 🔐 [Token Validation Guide](api-gateway/TOKEN_VALIDATION_GUIDE.md)
- 💻 [Backend User Context Examples](docs/BACKEND_USER_CONTEXT_EXAMPLES.md)

### Token Validation Feature

The API Gateway now supports two token validation strategies:

**Local Validation** (Default - Faster ⚡)
```env
TOKEN_VALIDATION_STRATEGY=local
```
- Gateway verifies JWT directly
- ~1-5ms latency
- No auth service dependency

**API Validation** (More Secure 🔐)
```env
TOKEN_VALIDATION_STRATEGY=api
```
- Gateway calls auth service to verify token
- Can check user status in real-time
- Can revoke tokens immediately
- ~10-50ms latency

Both strategies forward identical user information to backend services via headers:
- `x-user-id`
- `x-user-email`
- `x-user-role`
- `x-user-name`
- `x-user-phone`

### Backend Services - No Changes Needed!

Backend services don't need to validate JWT tokens. They simply read the user context headers:

```typescript
@Get('/my-data')
async getData(@Headers('x-user-id') userId: string) {
  // User already authenticated by gateway!
  return this.service.findByUserId(userId);
}
```

### Production Checklist

Before deploying to production:

- [ ] Change all placeholder secrets (JWT_SECRET, GATEWAY_INTERNAL_SECRET, etc.)
- [ ] Use strong, unique values for each secret
- [ ] Set NODE_ENV=production in all services
- [ ] Update all URLs to production domains
- [ ] Configure real email/SMS providers
- [ ] Set strong database password
- [ ] Enable HTTPS
- [ ] Configure CORS with production domains
- [ ] Set up OAuth credentials (if using)
- [ ] Review and test token validation strategy

### Troubleshooting

**"JWT verification failed"**
- Run `.\verify-env-vars.ps1` to check if JWT_SECRET matches
- Ensure TOKEN_VALIDATION_STRATEGY is set correctly

**"Service not available"**
- Check microservice URLs are correct
- Verify services are running
- For Docker: use container names
- For local: use localhost

**"CORS error"**
- Add frontend URL to CORS_ORIGIN in api-gateway/.env
- Include protocol (http:// or https://)

### Need Help?

1. Run verification: `.\verify-env-vars.ps1`
2. Check documentation: `docs/ENVIRONMENT_VARIABLES_GUIDE.md`
3. Review example files: `*.env.example`
