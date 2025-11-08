# V2-Bucket Docker Deployment Guide

Complete guide for deploying V2-Bucket with local PostgreSQL, Redis, and Tailscale Funnel for public access.

## 📋 Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                  Tailscale Funnel                       │
│        https://v2bucket.discus-likert.ts.net           │
└──────────────────┬──────────────────────────────────────┘
                   │
         ┌─────────┴─────────┐
         │                   │
    Port 3001            Port 3000
    (Web UI)             (API)
         │                   │
    ┌────▼────┐         ┌────▼────┐
    │   Web   │◄────────┤   API   │
    │Container│         │Container│
    └─────────┘         └────┬────┘
                             │
                    ┌────────┴────────┐
                    │                 │
              ┌─────▼─────┐    ┌─────▼─────┐
              │PostgreSQL │    │   Redis   │
              │ Container │    │ Container │
              └───────────┘    └───────────┘
```

## 🚀 Quick Start

### Prerequisites
- Docker and Docker Compose installed on Synology NAS
- Tailscale account with auth key
- Git repository access

### Deployment Steps

1. **Upload files to NAS:**
   ```bash
   /volume1/docker/v2-bucket/
   ├── docker-compose.yml
   ├── .env
   └── tailscale-config/
       ├── serve.json
       └── README.md
   ```

2. **Start all containers:**
   ```bash
   cd /volume1/docker/v2-bucket
   docker-compose up -d
   ```

3. **Wait for containers (this takes 10-15 minutes):**
   ```bash
   # Watch the logs
   docker-compose logs -f

   # Or check status
   docker-compose ps
   ```

4. **Configure Tailscale Funnel:**
   ```bash
   # Enable serve for web UI
   docker exec v2bucket-tailscale tailscale serve --bg --https=443 / http://127.0.0.1:3001

   # Enable serve for API
   docker exec v2bucket-tailscale tailscale serve --bg --https=443 /api http://127.0.0.1:3000

   # Enable public access (Funnel)
   docker exec v2bucket-tailscale tailscale funnel --bg 443 on

   # Verify
   docker exec v2bucket-tailscale tailscale serve status
   ```

5. **Access your application:**
   - Web UI: https://v2bucket.discus-likert.ts.net
   - API: https://v2bucket.discus-likert.ts.net/api

## 📦 Container Details

### Services

| Service | Container Name | Port | Status Check |
|---------|---------------|------|--------------|
| PostgreSQL | v2bucket-postgres | 5433:5432 | `docker logs v2bucket-postgres` |
| Redis | v2bucket-redis | 6380:6379 | `docker logs v2bucket-redis` |
| Builder | v2bucket-builder | - | Health check on `.ready` file |
| API | v2bucket-api | 3000:3000 | Health check on `/health` |
| Web | v2bucket-web | 3001:3001 | Health check on root |
| Tailscale | v2bucket-tailscale | Host network | `docker exec v2bucket-tailscale tailscale status` |

### Startup Sequence

1. **PostgreSQL** & **Redis** - Start and become healthy (~10 seconds)
2. **Builder** - Clones repository (~30-60 seconds)
3. **API** - Installs dependencies, runs migrations (~5-10 minutes)
4. **Web** - Builds Next.js app (~5-10 minutes)
5. **Tailscale** - Connects to Tailscale network (~5 seconds)

## 🔧 Configuration Files

### docker-compose.yml

- **PostgreSQL**: Port 5433 (external), 5432 (internal)
- **Redis**: Port 6380 (external), 6379 (internal)
- **API**: Port 3000
- **Web**: Port 3001
- **Tailscale**: Host network mode

### .env

Contains:
- Tailscale auth key
- Database credentials (for reference)
- API and web ports (for local testing)

### tailscale-config/serve.json

Defines:
- Web UI routing: `/` → port 3001
- API routing: `/api/` → port 3000
- Funnel enabled on port 443

## 🛠️ Common Operations

### View Logs

```bash
# All containers
docker-compose logs -f

# Specific container
docker logs v2bucket-api -f
docker logs v2bucket-web -f
docker logs v2bucket-postgres -f
```

### Restart Containers

```bash
# All containers
docker-compose restart

# Specific container
docker-compose restart api
docker-compose restart web
```

### Update Application

```bash
# Stop containers
docker-compose down

# Remove build cache to force fresh clone
docker volume rm v2bucket-build-cache

# Start containers
docker-compose up -d
```

### Access Container Shell

```bash
# API container
docker exec -it v2bucket-api sh

# Web container
docker exec -it v2bucket-web sh

# PostgreSQL
docker exec -it v2bucket-postgres psql -U postgres -d v2bucket
```

## 🔍 Troubleshooting

### Web Container Not Starting

Check if the build completed:
```bash
docker logs v2bucket-web --tail 100
```

Common issues:
- Insufficient memory (Next.js build needs ~2GB)
- Builder not finished cloning repository
- Network issues

### API Container Failing

Check database connection:
```bash
docker logs v2bucket-api --tail 100
```

Common issues:
- PostgreSQL not ready
- Migration failures
- Missing environment variables

### Tailscale Not Connecting

```bash
# Check Tailscale status
docker logs v2bucket-tailscale

# Verify auth key
docker exec v2bucket-tailscale tailscale status

# Restart Tailscale
docker-compose restart tailscale
```

### Database Connection Issues

```bash
# Test PostgreSQL connection
docker exec v2bucket-postgres psql -U postgres -d v2bucket -c "SELECT version();"

# Test Redis connection
docker exec v2bucket-redis redis-cli ping
```

## 📊 Health Checks

All containers have health checks:

```bash
# Check health status
docker-compose ps

# Expected output:
# NAME                 STATUS
# v2bucket-api         Up (healthy)
# v2bucket-builder     Up (healthy)
# v2bucket-postgres    Up (healthy)
# v2bucket-redis       Up (healthy)
# v2bucket-web         Up (healthy)
# v2bucket-tailscale   Up
```

## 🔐 Security Notes

### Current Setup (Development/Testing)

- Database credentials are in docker-compose.yml
- Tailscale auth key is in .env file
- JWT secrets are static

### Production Recommendations

1. Use Docker secrets or external secret management
2. Rotate Tailscale auth keys regularly
3. Use strong, unique passwords for PostgreSQL
4. Enable Redis password authentication
5. Use environment-specific JWT secrets

## 🌐 Public Access with Tailscale Funnel

### How It Works

Tailscale Funnel creates a public HTTPS endpoint that:
- Routes traffic through Tailscale's infrastructure
- Provides free SSL/TLS certificates
- Requires no port forwarding
- Works behind NAT/firewall
- No Tailscale client needed for visitors

### Tailscale Commands

```bash
# Check current serve configuration
docker exec v2bucket-tailscale tailscale serve status

# Reset serve configuration
docker exec v2bucket-tailscale tailscale serve reset

# Disable funnel
docker exec v2bucket-tailscale tailscale funnel --bg 443 off

# Enable funnel
docker exec v2bucket-tailscale tailscale funnel --bg 443 on
```

## 📈 Performance Tuning

### Resource Limits

Consider adding to docker-compose.yml:

```yaml
services:
  api:
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 2G
        reservations:
          cpus: '1'
          memory: 1G
```

### Build Optimization

- Build cache is persistent across restarts
- Use `docker-compose build --no-cache` to force rebuild
- Monitor build logs for optimization opportunities

## 🔄 Backup and Restore

### Backup Volumes

```bash
# Backup PostgreSQL data
docker run --rm -v v2bucket-postgres-data:/data -v $(pwd):/backup alpine tar czf /backup/postgres-backup.tar.gz -C /data .

# Backup Redis data
docker run --rm -v v2bucket-redis-data:/data -v $(pwd):/backup alpine tar czf /backup/redis-backup.tar.gz -C /data .

# Backup storage
docker run --rm -v v2bucket-storage-data:/data -v $(pwd):/backup alpine tar czf /backup/storage-backup.tar.gz -C /data .
```

### Restore Volumes

```bash
# Restore PostgreSQL
docker run --rm -v v2bucket-postgres-data:/data -v $(pwd):/backup alpine tar xzf /backup/postgres-backup.tar.gz -C /data

# Restore Redis
docker run --rm -v v2bucket-redis-data:/data -v $(pwd):/backup alpine tar xzf /backup/redis-backup.tar.gz -C /data

# Restore storage
docker run --rm -v v2bucket-storage-data:/data -v $(pwd):/backup alpine tar xzf /backup/storage-backup.tar.gz -C /data
```

## 📝 Environment Variables

### Required in docker-compose.yml

- `DATABASE_URL`: PostgreSQL connection string
- `REDIS_URL`: Redis connection string
- `JWT_SECRET`: Authentication secret
- `BETTER_AUTH_SECRET`: Better Auth secret
- `BETTER_AUTH_URL`: Public URL for auth
- `CORS_ORIGIN`: Allowed CORS origin
- `NEXT_PUBLIC_API_URL`: Public API URL

### Required in .env

- `TS_AUTHKEY`: Tailscale authentication key
- `TS_HOSTNAME`: Tailscale hostname (v2bucket)

## 🎯 Success Indicators

Your deployment is successful when:

1. ✅ All containers show "healthy" status
2. ✅ Web UI accessible at https://v2bucket.discus-likert.ts.net
3. ✅ API responding at https://v2bucket.discus-likert.ts.net/api
4. ✅ Tailscale serve status shows "Funnel on"
5. ✅ No error logs in any container
6. ✅ Database migrations completed successfully

## 📞 Support

For issues:
1. Check container logs
2. Verify health checks
3. Review Tailscale configuration
4. Check GitHub repository issues: https://github.com/sorathiyavatsal/v2-Bucket/issues

---

**Last Updated:** 2025-11-08
**Version:** 1.0.0
