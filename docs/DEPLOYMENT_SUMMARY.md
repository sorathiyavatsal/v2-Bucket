# V2-Bucket Docker Deployment Summary

Complete single-command Docker deployment setup for V2-Bucket platform.

---

## Created Files Overview

### 1. **docker-compose.yml** (Root Directory)
**Purpose**: Main orchestration file for all services

**Services Included:**
- PostgreSQL 14 (Database)
- Redis 7 (Cache)
- API Server (Fastify + tRPC)
- Web UI (Next.js 15)

**Features:**
- Health checks for all services
- Persistent volumes for data
- Environment variable configuration
- Service dependencies
- Network isolation
- Auto-restart on failure

### 2. **.env.example** (Root Directory)
**Purpose**: Environment variables template

**Configuration Sections:**
- Database credentials (PostgreSQL)
- Cache credentials (Redis)
- Authentication secrets (JWT, Better-Auth)
- Application settings (URLs, ports)
- OAuth providers (Google, GitHub)
- Storage configuration
- Email/SMTP settings
- Logging levels

### 3. **apps/api/Dockerfile**
**Purpose**: Multi-stage production build for API server

**Build Stages:**
1. **deps**: Install dependencies with pnpm
2. **builder**: Generate Prisma client and build TypeScript
3. **runner**: Minimal production image

**Features:**
- Non-root user (nodejs:1001)
- Security with dumb-init
- Health checks
- Automatic database migrations
- Optimized layer caching

### 4. **apps/web/Dockerfile**
**Purpose**: Multi-stage production build for Web UI

**Build Stages:**
1. **deps**: Install dependencies
2. **builder**: Build Next.js with standalone output
3. **runner**: Minimal production image

**Features:**
- Next.js standalone mode
- Non-root user (nextjs:1001)
- Static asset optimization
- Health checks
- Build-time environment injection

### 5. **apps/api/.dockerignore**
**Purpose**: Exclude unnecessary files from API Docker build

**Excludes:**
- Development files (node_modules, logs)
- Build artifacts (dist, .next)
- Environment files (.env, .env.local)
- IDE and OS files (.vscode, .DS_Store)
- Documentation (*.md, docs/)

### 6. **apps/web/.dockerignore**
**Purpose**: Exclude unnecessary files from Web Docker build

**Similar exclusions to API plus:**
- Next.js build cache (.next, out)
- Test files (*.test.ts, __tests__)

### 7. **NAS_DEPLOYMENT.md** (Root Directory)
**Purpose**: Comprehensive deployment guide for NAS devices

**Content:**
- Prerequisites and system requirements
- Step-by-step deployment (3 steps)
- Synology NAS instructions (Container Manager + SSH)
- QNAP NAS instructions (Container Station + SSH)
- Generic Linux server deployment
- Configuration details
- Troubleshooting guide
- Backup and restore procedures
- Security best practices
- Maintenance tasks

### 8. **deploy.sh** (Root Directory)
**Purpose**: Automated deployment script with validation

**Features:**
- Prerequisites checking (Docker, Docker Compose)
- Environment validation
- Secret generation (optional)
- Automated build and deployment
- Service health monitoring
- Error handling and cleanup
- Colorized output
- Multiple operation modes

**Commands:**
```bash
./deploy.sh           # Full deployment
./deploy.sh --help    # Show help
./deploy.sh --stop    # Stop services
./deploy.sh --restart # Restart services
./deploy.sh --no-build # Deploy without building
```

### 9. **QUICK_START.md** (Root Directory)
**Purpose**: Simplified 3-step deployment guide

**Content:**
- Minimal prerequisites
- 3-step deployment process
- First login instructions
- S3 API configuration
- AWS CLI setup and testing
- Useful Docker commands
- NAS-specific quick instructions
- Basic troubleshooting
- Next steps

### 10. **apps/web/next.config.js** (Updated)
**Purpose**: Next.js configuration for Docker

**Added:**
```javascript
output: 'standalone'  // Enable Docker deployment
```

This enables Next.js standalone output mode for optimized Docker containers.

---

## Directory Structure

```
v2-bucket/
├── docker-compose.yml          # Main orchestration file
├── .env.example                # Environment template
├── .env                        # Your configuration (create from .env.example)
├── deploy.sh                   # Automated deployment script
├── NAS_DEPLOYMENT.md          # Complete NAS deployment guide
├── QUICK_START.md             # 3-step quick start guide
├── DEPLOYMENT_SUMMARY.md      # This file
│
├── apps/
│   ├── api/
│   │   ├── Dockerfile         # API production build
│   │   ├── .dockerignore      # API build exclusions
│   │   └── src/               # API source code
│   │
│   └── web/
│       ├── Dockerfile         # Web UI production build
│       ├── .dockerignore      # Web build exclusions
│       ├── next.config.js     # Next.js config (updated)
│       └── src/               # Web source code
│
└── packages/
    └── database/
        └── prisma/
            └── schema.prisma  # Database schema
```

---

## Deployment Architecture

```
┌─────────────────────────────────────────────────┐
│              Docker Network                      │
│  (v2bucket-network - bridge mode)               │
│                                                  │
│  ┌──────────────┐    ┌──────────────┐          │
│  │  PostgreSQL  │    │    Redis     │          │
│  │   Port 5432  │    │  Port 6379   │          │
│  │   (internal) │    │  (internal)  │          │
│  └──────────────┘    └──────────────┘          │
│         ▲                    ▲                   │
│         │                    │                   │
│         └──────┬─────────────┘                   │
│                │                                  │
│         ┌──────▼──────┐                          │
│         │  API Server │                          │
│         │  Port 3000  │  ← Exposed               │
│         │  (Fastify)  │                          │
│         └──────┬──────┘                          │
│                │                                  │
│         ┌──────▼──────┐                          │
│         │   Web UI    │                          │
│         │  Port 3001  │  ← Exposed               │
│         │  (Next.js)  │                          │
│         └─────────────┘                          │
│                                                  │
└─────────────────────────────────────────────────┘
         │                    │
         │                    │
    Port 3000             Port 3001
    (API/S3)             (Dashboard)
```

---

## Data Persistence

**Docker Volumes Created:**

1. **v2bucket-postgres-data**
   - Location: Docker managed volume
   - Purpose: PostgreSQL database files
   - Backup: Critical - contains all metadata

2. **v2bucket-redis-data**
   - Location: Docker managed volume
   - Purpose: Redis cache and sessions
   - Backup: Recommended

3. **v2bucket-storage-data**
   - Location: Docker managed volume
   - Purpose: Uploaded files/objects
   - Backup: Critical - contains all user data

**Custom Volume Mounting** (Optional):

For NAS deployments, you can mount host directories:

```yaml
volumes:
  # Synology
  - /volume1/v2bucket-storage:/storage

  # QNAP
  - /share/v2bucket-storage:/storage

  # Linux
  - /mnt/data/v2bucket-storage:/storage
```

---

## Environment Variables Summary

### Required (Must Configure)

```env
POSTGRES_PASSWORD=<secure-password>
REDIS_PASSWORD=<secure-password>
JWT_SECRET=<32-char-random-string>
BETTER_AUTH_SECRET=<32-char-random-string>
```

### Optional (Recommended for Production)

```env
APP_URL=https://yourdomain.com
BETTER_AUTH_URL=https://api.yourdomain.com
NEXT_PUBLIC_API_URL=https://api.yourdomain.com
CORS_ORIGIN=https://yourdomain.com

SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password

GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-client-secret
```

---

## Port Mapping

| Service    | Internal Port | External Port | Configurable |
|------------|---------------|---------------|--------------|
| PostgreSQL | 5432          | 5432          | Yes          |
| Redis      | 6379          | 6379          | Yes          |
| API        | 3000          | 3000          | Yes          |
| Web UI     | 3001          | 3001          | Yes          |

**Change ports in `.env`:**
```env
POSTGRES_PORT=5433
REDIS_PORT=6380
API_PORT=8080
WEB_PORT=8081
```

---

## Deployment Methods

### Method 1: Automated Script (Recommended)
```bash
chmod +x deploy.sh
./deploy.sh
```

**Advantages:**
- Validates prerequisites
- Checks environment variables
- Generates secrets automatically
- Monitors deployment progress
- Displays helpful information
- Error handling and cleanup

### Method 2: Manual Docker Compose
```bash
cp .env.example .env
nano .env  # Configure
docker-compose up -d
```

**Advantages:**
- Full control over process
- Suitable for automation/CI-CD
- Simpler for experienced users

### Method 3: NAS GUI (Synology/QNAP)
**Advantages:**
- No command line required
- Visual interface
- Easy for beginners
- Built-in container management

---

## Health Checks

All services include health checks:

**PostgreSQL:**
```bash
pg_isready -U v2bucket
```

**Redis:**
```bash
redis-cli ping
```

**API:**
```bash
curl http://localhost:3000/health
```

**Web UI:**
```bash
curl http://localhost:3001
```

Docker automatically restarts unhealthy containers.

---

## Security Features

1. **Non-root Containers**: All services run as non-root users
2. **Network Isolation**: Services communicate on private network
3. **Secret Management**: Environment-based configuration
4. **Health Monitoring**: Automatic restart on failure
5. **Signal Handling**: Proper shutdown with dumb-init
6. **Build Optimization**: Multi-stage builds reduce attack surface

---

## Backup Recommendations

**Daily Automated Backup:**
```bash
# Database
docker-compose exec -T postgres pg_dump -U v2bucket v2bucket | gzip > backup.sql.gz

# Storage
docker run --rm -v v2bucket-storage-data:/data -v $(pwd):/backup \
  alpine tar czf /backup/storage.tar.gz -C /data .
```

**Schedule with cron:**
```cron
0 2 * * * /path/to/v2-bucket/backup.sh
```

---

## Troubleshooting Quick Reference

**Service won't start:**
```bash
docker-compose logs <service-name>
```

**Port already in use:**
```bash
# Change in .env
API_PORT=8080
WEB_PORT=8081
```

**Database connection failed:**
```bash
docker-compose restart postgres
docker-compose logs postgres
```

**Reset everything:**
```bash
docker-compose down -v  # WARNING: Deletes data
docker-compose up -d
```

---

## Next Steps After Deployment

1. **Access Web UI**: http://your-ip:3001
2. **Create admin account**
3. **Generate S3 access keys**
4. **Configure AWS CLI**
5. **Test S3 operations**
6. **Set up HTTPS** (production)
7. **Configure backups**
8. **Enable monitoring**

---

## Resources

- **Quick Start**: [QUICK_START.md](QUICK_START.md)
- **NAS Deployment**: [NAS_DEPLOYMENT.md](NAS_DEPLOYMENT.md)
- **API Documentation**: [docs/API.md](docs/API.md)
- **Full Documentation**: [README.md](README.md)

---

## Support

For issues or questions:
- Check troubleshooting sections in documentation
- Review Docker logs: `docker-compose logs`
- GitHub Issues: https://github.com/yourusername/v2-bucket/issues

---

**Deployment is complete!** Your V2-Bucket platform is production-ready and can be deployed with a single command.
