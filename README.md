# 🏪 Local Service Marketplace - Complete Platform

A production-ready microservices-based marketplace platform connecting service providers with customers.

## 🚀 Quick Start

### One-Line Startup (Recommended)

```powershell
# Windows PowerShell
.\start.ps1
```

That's it! The entire platform will start automatically:
- ✅ Database & Cache (PostgreSQL, Redis)
- ✅ 12 Backend Microservices
- ✅ API Gateway
- ✅ Next.js Frontend

**Access the application**: http://localhost:3001

---

## 📋 Prerequisites

- **Docker Desktop** (20.x+) - [Download](https://www.docker.com/products/docker-desktop)
- **Docker Compose** (2.x+) - Included with Docker Desktop
- **4GB RAM minimum** (8GB recommended)

---

## 🎯 What's Included

### Infrastructure
- **PostgreSQL 16** - Main database
- **Redis 7** - Cache & queuing

### Backend Services (NestJS)
| Service | Port | Description |
|---------|------|-------------|
| Auth Service | 3001 | Authentication & authorization |
| User Service | 3002 | User profiles & provider management |
| Request Service | 3003 | Service request CRUD |
| Proposal Service | 3004 | Proposal management |
| Job Service | 3005 | Job lifecycle management |
| Payment Service | 3006 | Payment processing & refunds |
| Messaging Service | 3007 | Real-time messaging |
| Notification Service | 3008 | Notification delivery |
| Review Service | 3009 | Reviews & ratings |
| Admin Service | 3010 | Admin operations |
| Analytics Service | 3011 | Platform analytics |
| Infrastructure Service | 3012 | Events & background jobs |

### API Gateway (Port 3000)
- Request routing
- Rate limiting
- JWT authentication
- Load balancing

### Frontend (Next.js 14)
- **Port**: 3001
- Modern React UI with TypeScript
- TailwindCSS styling
- React Query for data fetching
- Real-time updates

---

## 📚 Documentation

- **[STARTUP_GUIDE.md](STARTUP_GUIDE.md)** - Comprehensive startup instructions
- **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)** - System architecture overview
- **[docs/API_SPECIFICATION.md](docs/API_SPECIFICATION.md)** - Complete API documentation
- **[docs/IMPLEMENTATION_GUIDE.md](docs/IMPLEMENTATION_GUIDE.md)** - Implementation details
- **[docs/MICROSERVICE_BOUNDARY_MAP.md](docs/MICROSERVICE_BOUNDARY_MAP.md)** - Service boundaries
- **[frontend/nextjs-app/README.md](frontend/nextjs-app/README.md)** - Frontend documentation

---

## 🛠️ Common Commands

### Start Everything
```powershell
# Using startup script
.\start.ps1

# Or using docker-compose directly
docker-compose up -d
```

### Stop Everything
```powershell
# Using stop script
.\stop.ps1

# Or using docker-compose directly
docker-compose stop
```

### View Logs
```powershell
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f api-gateway
docker-compose logs -f frontend
```

### Restart Services
```powershell
docker-compose restart
```

### Rebuild After Changes
```powershell
docker-compose up -d --build
```

### Clean Reset (Removes all data)
```powershell
docker-compose down -v
```

---

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     Frontend (Next.js)                      │
│                     localhost:3001                          │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│                    API Gateway (NestJS)                     │
│                     localhost:3000                          │
│  - Request Routing  - Rate Limiting  - Authentication      │
└───────────────────────┬─────────────────────────────────────┘
                        │
        ┌───────────────┴────────────────┐
        ▼                                ▼
┌──────────────────┐          ┌──────────────────┐
│   Microservices  │          │  Infrastructure  │
│   (12 services)  │          │                  │
│   Ports 3001-12  │          │  - PostgreSQL    │
│                  │          │  - Redis         │
└──────────────────┘          └──────────────────┘
```

---

## 🔐 Security

### Default Credentials (Development Only)

**PostgreSQL:**
- Host: localhost:5432
- Database: marketplace
- User: postgres
- Password: postgres

**Important**: Change these in `.env` for production!

### JWT Secret

The default JWT secret in `.env.example` is for development only. Generate a secure secret for production:

```powershell
# Generate secure random secret (32+ characters)
$bytes = New-Object byte[] 32
(New-Object Random).NextBytes($bytes)
[Convert]::ToBase64String($bytes)
```

Update `.env` with the generated secret.

---

## 📊 Project Structure

```
Local Service Marketplace/
├── 📁 services/              # 12 NestJS microservices
│   ├── auth-service/
│   ├── user-service/
│   ├── request-service/
│   ├── proposal-service/
│   ├── job-service/
│   ├── payment-service/
│   ├── messaging-service/
│   ├── notification-service/
│   ├── review-service/
│   ├── admin-service/
│   ├── analytics-service/
│   └── infrastructure-service/
│
├── 📁 api-gateway/          # NestJS API Gateway
│
├── 📁 frontend/             # Next.js 14 frontend
│   └── nextjs-app/
│
├── 📁 database/             # Database schema
│   └── schema.sql
│
├── 📁 docs/                 # Documentation
│   ├── ARCHITECTURE.md
│   ├── API_SPECIFICATION.md
│   ├── IMPLEMENTATION_GUIDE.md
│   └── MICROSERVICE_BOUNDARY_MAP.md
│
├── 📁 docker/               # Docker configurations
│
├── 📄 docker-compose.yml    # Complete platform orchestration
├── 📄 .env.example          # Environment variables template
├── 📄 start.ps1            # Quick start script
├── 📄 stop.ps1             # Quick stop script
└── 📄 STARTUP_GUIDE.md     # Detailed startup guide
```

---

## 🧪 Testing

### 1. Access Frontend
Open http://localhost:3001

### 2. Create Account
- Click "Sign Up"
- Choose role (Customer or Provider)
- Complete registration

### 3. Test Features
- ✅ Dashboard overview
- ✅ Create service request
- ✅ Browse requests
- ✅ Send proposals (as provider)
- ✅ Accept/reject proposals
- ✅ Job management
- ✅ Messaging
- ✅ Notifications

---

## 🐛 Troubleshooting

### Services won't start?

1. **Check Docker is running**
   ```powershell
   docker --version
   ```

2. **Check ports are available**
   ```powershell
   netstat -ano | findstr "3000 3001 5432"
   ```

3. **View logs for errors**
   ```powershell
   docker-compose logs
   ```

4. **Clean restart**
   ```powershell
   docker-compose down -v
   docker-compose up -d --build
   ```

### Can't access frontend?

Wait 1-2 minutes for all services to become healthy. Check status:
```powershell
docker-compose ps
```

### Database connection errors?

Ensure PostgreSQL is healthy:
```powershell
docker-compose ps postgres
docker-compose logs postgres
```

---

## 📈 Performance

### Resource Usage (Estimated)
- **Memory**: 2-4GB total
- **CPU**: 2-4 cores
- **Disk**: 5GB for images + data
- **Startup Time**: 2-3 minutes (first run), 30-60 seconds (subsequent)

### Optimization Tips
1. Allocate 8GB RAM to Docker Desktop
2. Use SSD for Docker storage
3. Close unnecessary applications
4. Enable WSL 2 backend (Windows)

---

## 🚢 Deployment

### Development
```powershell
docker-compose up -d
```

### Production
See [STARTUP_GUIDE.md](STARTUP_GUIDE.md) for production deployment instructions including:
- Environment variable configuration
- SSL/TLS setup
- Scaling strategies
- Monitoring setup

---

## 🔧 Development Workflow

### Making Changes

**Backend Service:**
```powershell
# Rebuild specific service
docker-compose build auth-service
docker-compose up -d auth-service
```

**Frontend:**
```powershell
# Rebuild frontend
docker-compose build frontend
docker-compose up -d frontend
```

**Full Rebuild:**
```powershell
docker-compose up -d --build
```

---

## 📱 Platform Features

### For Customers
- ✅ Post service requests
- ✅ Receive proposals from providers
- ✅ Compare and select providers
- ✅ Track job progress
- ✅ Make payments
- ✅ Leave reviews
- ✅ Real-time messaging

### For Service Providers
- ✅ Browse service requests
- ✅ Submit proposals
- ✅ Manage jobs
- ✅ Track earnings
- ✅ Communicate with customers
- ✅ Build reputation

### For Admins
- ✅ User management
- ✅ Dispute resolution
- ✅ Platform analytics
- ✅ System monitoring
- ✅ Audit logs

---

## 🎯 Technology Stack

### Backend
- **Framework**: NestJS (Node.js)
- **Language**: TypeScript
- **Database**: PostgreSQL 16
- **Cache**: Redis 7
- **Architecture**: Microservices

### Frontend
- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: TailwindCSS
- **State**: React Query + Zustand
- **HTTP Client**: Axios

### DevOps
- **Containerization**: Docker
- **Orchestration**: Docker Compose
- **Development**: Hot reload enabled

---

## 📞 Support

For issues or questions:
1. Check [STARTUP_GUIDE.md](STARTUP_GUIDE.md)
2. Review service logs: `docker-compose logs -f`
3. Check documentation in `/docs`
4. Verify prerequisites are installed

---

## 📝 License

This project is part of the Local Service Marketplace platform.

---

## 🎉 Success Checklist

- [ ] Docker Desktop installed and running
- [ ] Ran `.\start.ps1` or `docker-compose up -d`
- [ ] All services showing as healthy: `docker-compose ps`
- [ ] Can access frontend: http://localhost:3001
- [ ] Can access API: http://localhost:3000/health
- [ ] Created test account and logged in

---

**Built with ❤️ using modern microservices architecture**

Last Updated: March 2026
