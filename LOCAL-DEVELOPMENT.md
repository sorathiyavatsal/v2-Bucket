# Local Development Setup

This guide explains how to run the V2-Bucket platform locally for development.

## Prerequisites

- Docker and Docker Compose installed
- Node.js 20+ installed
- pnpm 9+ installed (`npm install -g pnpm@9`)

## Option 1: Full Docker Setup (Recommended for Testing)

Run everything in Docker containers - includes PostgreSQL, Redis, API, and Web UI.

### Start All Services

```bash
cd "c:\Project\CineMaxPlaza\Synology S3 Bucket\v2-bucket"
docker-compose up -d
```

### Check Service Status

```bash
docker-compose ps
```

All services should be "Up" and "healthy":
- `v2bucket-postgres` - PostgreSQL database
- `v2bucket-redis` - Redis cache
- `v2bucket-builder` - Build cache
- `v2bucket-api` - Backend API
- `v2bucket-web` - Frontend web UI
- `v2bucket-tailscale` - Tailscale for public access

### Access the Application

- **Web UI**: http://localhost:3001
- **API**: http://localhost:3000
- **API Health**: http://localhost:3000/health

### View Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f api
docker-compose logs -f web
```

### Stop Services

```bash
docker-compose down
```

### Reset Everything (Clean Start)

```bash
# Stop and remove all containers, volumes, and data
docker-compose down -v

# Start fresh
docker-compose up -d
```

---

## Option 2: Local Development with Docker Databases

Run PostgreSQL and Redis in Docker, but run API and Web locally for faster development iterations.

### Step 1: Start Database Services Only

```bash
docker-compose up -d postgres redis
```

### Step 2: Verify Database Connections

```bash
# Check PostgreSQL
docker exec v2bucket-postgres pg_isready -U postgres -d v2bucket

# Check Redis
docker exec v2bucket-redis redis-cli ping
```

### Step 3: Install Dependencies

```bash
cd "c:\Project\CineMaxPlaza\Synology S3 Bucket\v2-bucket"
pnpm install
```

### Step 4: Setup Database

```bash
cd packages/database

# Generate Prisma client
pnpm exec prisma generate

# Run migrations
pnpm exec prisma migrate dev

# (Optional) Seed database
pnpm exec prisma db seed
```

### Step 5: Start API Server

```bash
cd apps/api
pnpm dev
```

API will run on http://localhost:3000

### Step 6: Start Web UI (New Terminal)

```bash
cd apps/web
pnpm dev
```

Web UI will run on http://localhost:3001

---

## Environment Configuration

### Development (.env)

The `.env` file is configured for local development:

```env
# PostgreSQL - External port 5433 maps to internal 5432
DATABASE_URL=postgresql://postgres:postgres@localhost:5433/v2bucket

# Redis - External port 6380 maps to internal 6379
REDIS_URL=redis://localhost:6380

# API & Auth
NEXT_PUBLIC_API_URL=http://localhost:3000
BETTER_AUTH_URL=http://localhost:3001
CORS_ORIGIN=http://localhost:3001
```

**Why Different Ports?**
- Docker containers expose services on non-standard ports to avoid conflicts
- PostgreSQL: 5433 (external) → 5432 (internal)
- Redis: 6380 (external) → 6379 (internal)

### Docker Containers (.env used by docker-compose.yml)

For services running INSIDE Docker, they use internal service names:

```env
DATABASE_URL=postgresql://postgres:postgres@postgres:5432/v2bucket
REDIS_URL=redis://redis:6379
```

---

## Database Access

### PostgreSQL Access

**Using Docker**:
```bash
# Connect to PostgreSQL CLI
docker exec -it v2bucket-postgres psql -U postgres -d v2bucket

# Run SQL commands
# Example: View all users
SELECT id, email, "isAdmin", "createdAt" FROM "User";

# Exit
\q
```

**Using Prisma Studio**:
```bash
cd packages/database
pnpm exec prisma studio
```

Opens a web UI at http://localhost:5555 to browse and edit database records.

**Direct Connection** (using any PostgreSQL client):
- Host: `localhost`
- Port: `5433`
- Database: `v2bucket`
- User: `postgres`
- Password: `postgres`

### Redis Access

```bash
# Connect to Redis CLI
docker exec -it v2bucket-redis redis-cli

# Test Redis
PING
# Should return: PONG

# View all keys
KEYS *

# Get a key value
GET key_name

# Exit
exit
```

---

## Common Development Tasks

### Reset Database

```bash
# Delete all data and recreate schema
cd packages/database
pnpm exec prisma migrate reset

# Or manually
docker exec v2bucket-postgres psql -U postgres -d v2bucket -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
pnpm exec prisma migrate dev
```

### Clear Redis Cache

```bash
docker exec v2bucket-redis redis-cli FLUSHALL
```

### View API Logs

```bash
# If using Docker
docker-compose logs -f api

# If running locally
# Logs will appear in the terminal where you ran `pnpm dev`
```

### Rebuild Containers

```bash
# Rebuild and restart all services
docker-compose up -d --build

# Rebuild specific service
docker-compose up -d --build api
```

---

## Troubleshooting

### Port Already in Use

**Error**: `Bind for 0.0.0.0:5433 failed: port is already allocated`

**Solution**:
```bash
# Find what's using the port
netstat -ano | findstr :5433

# Stop the process or change the port in docker-compose.yml
```

### Database Connection Failed

**Check if PostgreSQL is running**:
```bash
docker ps | grep postgres
```

**Check PostgreSQL logs**:
```bash
docker logs v2bucket-postgres
```

**Verify connection string in .env**:
```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5433/v2bucket
```

### Redis Connection Failed

**Check if Redis is running**:
```bash
docker ps | grep redis
```

**Test Redis connection**:
```bash
docker exec v2bucket-redis redis-cli ping
```

**Verify connection string in .env**:
```env
REDIS_URL=redis://localhost:6380
```

### First User Not Becoming Admin

**Check the database**:
```bash
docker exec -it v2bucket-postgres psql -U postgres -d v2bucket -c 'SELECT id, email, "isAdmin" FROM "User";'
```

**Manually make a user admin**:
```bash
docker exec -it v2bucket-postgres psql -U postgres -d v2bucket -c "UPDATE \"User\" SET \"isAdmin\" = true WHERE email = 'your-email@example.com';"
```

### API Not Starting

**Check API logs**:
```bash
docker logs v2bucket-api --tail 100
```

**Common issues**:
1. Database not ready → Wait 30 seconds and check again
2. Build cache not ready → Wait for builder container to be healthy
3. Port already in use → Change port in docker-compose.yml

---

## Development Workflow

### Recommended Flow for Frontend Development

1. Start only databases:
   ```bash
   docker-compose up -d postgres redis
   ```

2. Start API locally:
   ```bash
   cd apps/api && pnpm dev
   ```

3. Start Web locally:
   ```bash
   cd apps/web && pnpm dev
   ```

4. Make changes to code - auto-reloads!

### Recommended Flow for Backend Development

Same as above, but focus on `apps/api` directory.

### Testing the Full Stack

```bash
# Start everything in Docker
docker-compose up -d

# Wait for all services to be healthy
docker-compose ps

# Access at http://localhost:3001
```

---

## Service Ports Reference

| Service | Internal Port | External Port | Access URL |
|---------|--------------|---------------|------------|
| PostgreSQL | 5432 | 5433 | `localhost:5433` |
| Redis | 6379 | 6380 | `localhost:6380` |
| API | 3000 | 3000 | http://localhost:3000 |
| Web UI | 3001 | 3001 | http://localhost:3001 |
| Prisma Studio | 5555 | 5555 | http://localhost:5555 |

---

## Next Steps

After setting up your local environment:

1. **Create First Admin User**:
   - Visit http://localhost:3001/auth/signup
   - Register with your email
   - First user automatically becomes admin

2. **Explore the Application**:
   - Create buckets
   - Upload objects
   - Generate access keys
   - Test S3 API compatibility

3. **Development**:
   - Follow the [IMPLEMENTATION-GUIDE.md](IMPLEMENTATION-GUIDE.md) for feature implementation
   - Refer to [API-INTEGRATION-GUIDE.md](API-INTEGRATION-GUIDE.md) for API reference

---

## Production Deployment

For production deployment on Synology NAS or other servers, refer to [DEPLOYMENT.md](DEPLOYMENT.md).

**Key Differences**:
- Use production secrets (not `development-secret-key`)
- Enable Tailscale Funnel for public HTTPS access
- Configure proper backup strategy
- Set up monitoring and alerts
- Use proper volume paths for persistent data
