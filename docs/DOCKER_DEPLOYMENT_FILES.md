# Complete Docker Deployment Files

## ✅ Files Created

1. **apps/api/Dockerfile** - ✅ Created

## 📝 Remaining Files to Create

Copy the content below into the respective files:

---

## 2. apps/api/.dockerignore

```
node_modules
dist
*.log
.env
.env.*
!.env.example
coverage
.turbo
.next
```

---

## 3. apps/web/Dockerfile

```dockerfile
# V2-Bucket Web Dockerfile
# Multi-stage build for optimized Next.js production

# Stage 1: Dependencies
FROM node:20-alpine AS deps
RUN npm install -g pnpm@9
WORKDIR /app

COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml* ./
COPY apps/web/package.json ./apps/web/
RUN pnpm install --frozen-lockfile

# Stage 2: Builder
FROM node:20-alpine AS builder
RUN npm install -g pnpm@9
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/web/node_modules ./apps/web/node_modules
COPY . .

WORKDIR /app/apps/web
RUN pnpm build

# Stage 3: Runner
FROM node:20-alpine AS runner
RUN apk add --no-cache dumb-init
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001

WORKDIR /app

ENV NODE_ENV production

COPY --from=builder /app/apps/web/public ./public
COPY --from=builder --chown=nodejs:nodejs /app/apps/web/.next/standalone ./
COPY --from=builder --chown=nodejs:nodejs /app/apps/web/.next/static ./.next/static

USER nodejs
EXPOSE 3000

ENV PORT 3000
ENV HOSTNAME "0.0.0.0"

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "server.js"]
```

---

## 4. apps/web/.dockerignore

```
node_modules
.next
out
*.log
.env
.env.*
!.env.example
coverage
.turbo
```

---

## 5. docker-compose.yml (Root - ALL-IN-ONE)

```yaml
version: '3.8'

services:
  # ============================================
  # PostgreSQL Database
  # ============================================
  postgres:
    image: postgres:14-alpine
    container_name: v2bucket-postgres
    restart: unless-stopped
    environment:
      POSTGRES_USER: ${POSTGRES_USER:-v2bucket}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:?POSTGRES_PASSWORD is required}
      POSTGRES_DB: ${POSTGRES_DB:-v2bucket}
      PGDATA: /var/lib/postgresql/data/pgdata
    volumes:
      - postgres-data:/var/lib/postgresql/data
    ports:
      - "${POSTGRES_PORT:-5432}:5432"
    networks:
      - v2bucket-network
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER:-v2bucket} -d ${POSTGRES_DB:-v2bucket}"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 10s

  # ============================================
  # Redis Cache
  # ============================================
  redis:
    image: redis:7-alpine
    container_name: v2bucket-redis
    restart: unless-stopped
    command: redis-server --requirepass ${REDIS_PASSWORD:?REDIS_PASSWORD is required}
    volumes:
      - redis-data:/data
    ports:
      - "${REDIS_PORT:-6379}:6379"
    networks:
      - v2bucket-network
    healthcheck:
      test: ["CMD", "redis-cli", "--raw", "incr", "ping"]
      interval: 10s
      timeout: 3s
      retries: 5
      start_period: 5s

  # ============================================
  # API Server (Backend)
  # ============================================
  api:
    build:
      context: .
      dockerfile: ./apps/api/Dockerfile
    container_name: v2bucket-api
    restart: unless-stopped
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    environment:
      # Node
      NODE_ENV: ${NODE_ENV:-production}
      PORT: 3000

      # Database
      DATABASE_URL: postgresql://${POSTGRES_USER:-v2bucket}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB:-v2bucket}

      # Redis
      REDIS_URL: redis://:${REDIS_PASSWORD}@redis:6379

      # Storage
      STORAGE_PATH: /storage
      STORAGE_MAX_FILE_SIZE: ${STORAGE_MAX_FILE_SIZE:-5368709120}
      STORAGE_MULTIPART_PART_SIZE: ${STORAGE_MULTIPART_PART_SIZE:-5242880}

      # JWT
      JWT_SECRET: ${JWT_SECRET:?JWT_SECRET is required}
      JWT_EXPIRES_IN: ${JWT_EXPIRES_IN:-7d}

      # CORS
      CORS_ORIGIN: ${CORS_ORIGIN:-http://localhost:3001}

      # Rate Limiting
      RATE_LIMIT_MAX: ${RATE_LIMIT_MAX:-1000}
      RATE_LIMIT_TIME_WINDOW: ${RATE_LIMIT_TIME_WINDOW:-1m}

      # Logging
      LOG_LEVEL: ${LOG_LEVEL:-info}
    volumes:
      - storage-data:/storage
    ports:
      - "${API_PORT:-3000}:3000"
    networks:
      - v2bucket-network
    healthcheck:
      test: ["CMD", "node", "-e", "require('http').get('http://localhost:3000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

  # ============================================
  # Web Dashboard (Frontend)
  # ============================================
  web:
    build:
      context: .
      dockerfile: ./apps/web/Dockerfile
      args:
        NEXT_PUBLIC_API_URL: ${NEXT_PUBLIC_API_URL:-http://localhost:3000}
    container_name: v2bucket-web
    restart: unless-stopped
    depends_on:
      api:
        condition: service_healthy
    environment:
      NODE_ENV: ${NODE_ENV:-production}
      NEXT_PUBLIC_API_URL: ${NEXT_PUBLIC_API_URL:-http://localhost:3000}
    ports:
      - "${WEB_PORT:-3001}:3000"
    networks:
      - v2bucket-network
    healthcheck:
      test: ["CMD", "node", "-e", "require('http').get('http://localhost:3000', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 30s

# ============================================
# Volumes (Persistent Data)
# ============================================
volumes:
  postgres-data:
    driver: local
  redis-data:
    driver: local
  storage-data:
    driver: local

# ============================================
# Networks
# ============================================
networks:
  v2bucket-network:
    driver: bridge
```

---

## 6. .env.example (Root)

```env
# ==============================================
# V2-Bucket Environment Configuration
# ==============================================
# Copy this file to .env and update values
# DO NOT commit .env to version control!
# ==============================================

# ----------------------------------------------
# Application
# ----------------------------------------------
NODE_ENV=production
LOG_LEVEL=info

# ----------------------------------------------
# PostgreSQL Database
# ----------------------------------------------
POSTGRES_USER=v2bucket
POSTGRES_PASSWORD=CHANGE_THIS_SECURE_PASSWORD_123!
POSTGRES_DB=v2bucket
POSTGRES_PORT=5432

DATABASE_URL=postgresql://v2bucket:CHANGE_THIS_SECURE_PASSWORD_123!@postgres:5432/v2bucket

# ----------------------------------------------
# Redis Cache
# ----------------------------------------------
REDIS_PASSWORD=CHANGE_THIS_REDIS_PASSWORD_456!
REDIS_PORT=6379
REDIS_URL=redis://:CHANGE_THIS_REDIS_PASSWORD_456!@redis:6379

# ----------------------------------------------
# Storage Configuration
# ----------------------------------------------
STORAGE_PATH=/storage
STORAGE_MAX_FILE_SIZE=5368709120        # 5GB in bytes
STORAGE_MULTIPART_PART_SIZE=5242880     # 5MB in bytes

# ----------------------------------------------
# JWT Authentication
# ----------------------------------------------
# Generate: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
JWT_SECRET=CHANGE_THIS_TO_RANDOM_32_CHAR_STRING_789
JWT_EXPIRES_IN=7d

# ----------------------------------------------
# CORS Configuration
# ----------------------------------------------
CORS_ORIGIN=http://localhost:3001

# ----------------------------------------------
# Rate Limiting
# ----------------------------------------------
RATE_LIMIT_MAX=1000
RATE_LIMIT_TIME_WINDOW=1m

# ----------------------------------------------
# Service Ports (External)
# ----------------------------------------------
API_PORT=3000
WEB_PORT=3001

# ----------------------------------------------
# Web Dashboard
# ----------------------------------------------
NEXT_PUBLIC_API_URL=http://localhost:3000
```

---

## 7. deploy.sh (Root - Deployment Script)

```bash
#!/bin/bash

# V2-Bucket Deployment Script
# This script deploys the entire V2-Bucket platform with one command

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Functions
print_header() {
    echo -e "\n${BLUE}================================================${NC}"
    echo -e "${BLUE}  $1${NC}"
    echo -e "${BLUE}================================================${NC}\n"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}! $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ $1${NC}"
}

# Check if Docker is installed
check_docker() {
    print_header "Checking Prerequisites"

    if ! command -v docker &> /dev/null; then
        print_error "Docker is not installed"
        echo "Please install Docker: https://docs.docker.com/get-docker/"
        exit 1
    fi
    print_success "Docker is installed"

    if ! command -v docker-compose &> /dev/null; then
        print_error "Docker Compose is not installed"
        echo "Please install Docker Compose: https://docs.docker.com/compose/install/"
        exit 1
    fi
    print_success "Docker Compose is installed"
}

# Check if .env exists
check_env() {
    if [ ! -f .env ]; then
        print_error ".env file not found"
        echo ""
        print_info "Creating .env from .env.example..."
        cp .env.example .env
        print_success ".env file created"
        echo ""
        print_warning "Please edit .env file and update the following:"
        echo "  - POSTGRES_PASSWORD"
        echo "  - REDIS_PASSWORD"
        echo "  - JWT_SECRET"
        echo ""
        echo "Then run this script again."
        exit 1
    fi
    print_success ".env file found"
}

# Validate required environment variables
validate_env() {
    print_header "Validating Environment Variables"

    source .env

    required_vars=("POSTGRES_PASSWORD" "REDIS_PASSWORD" "JWT_SECRET")
    default_values=("CHANGE_THIS" "password" "secret" "123")

    missing=0
    for var in "${required_vars[@]}"; do
        value="${!var}"
        if [ -z "$value" ]; then
            print_error "$var is not set"
            missing=1
        else
            # Check if still has default value
            is_default=0
            for default in "${default_values[@]}"; do
                if [[ "$value" == *"$default"* ]]; then
                    is_default=1
                    break
                fi
            done

            if [ $is_default -eq 1 ]; then
                print_warning "$var still has default value - please change it!"
                missing=1
            else
                print_success "$var is set"
            fi
        fi
    done

    if [ $missing -eq 1 ]; then
        echo ""
        print_error "Please update the environment variables in .env file"
        exit 1
    fi
}

# Stop and remove existing containers
cleanup() {
    print_header "Cleaning Up Existing Deployment"

    if docker-compose ps | grep -q "Up"; then
        print_info "Stopping existing containers..."
        docker-compose down
        print_success "Existing containers stopped"
    else
        print_info "No existing containers running"
    fi
}

# Build and start services
deploy() {
    print_header "Building and Starting Services"

    print_info "Building Docker images (this may take a few minutes)..."
    docker-compose build --no-cache
    print_success "Docker images built"

    print_info "Starting services..."
    docker-compose up -d
    print_success "Services started"
}

# Wait for services to be healthy
wait_for_services() {
    print_header "Waiting for Services to be Ready"

    services=("postgres" "redis" "api")
    max_wait=120  # Maximum wait time in seconds
    interval=5    # Check interval in seconds

    for service in "${services[@]}"; do
        print_info "Waiting for $service..."
        elapsed=0

        while [ $elapsed -lt $max_wait ]; do
            if docker-compose ps $service | grep -q "healthy"; then
                print_success "$service is healthy"
                break
            fi

            sleep $interval
            elapsed=$((elapsed + interval))

            if [ $elapsed -ge $max_wait ]; then
                print_error "$service failed to become healthy"
                docker-compose logs $service
                exit 1
            fi
        done
    done
}

# Display access information
display_info() {
    print_header "Deployment Successful!"

    source .env

    echo -e "${GREEN}V2-Bucket is now running!${NC}\n"

    echo -e "${BLUE}Access Points:${NC}"
    echo -e "  📱 Web Dashboard:  http://localhost:${WEB_PORT:-3001}"
    echo -e "  🔌 API Server:     http://localhost:${API_PORT:-3000}"
    echo -e "  📊 API Health:     http://localhost:${API_PORT:-3000}/health"
    echo -e "  📈 Metrics:        http://localhost:${API_PORT:-3000}/metrics"

    echo -e "\n${BLUE}Default Credentials (if seeded):${NC}"
    echo -e "  Email:    admin@v2bucket.com"
    echo -e "  Password: admin123"

    echo -e "\n${BLUE}Useful Commands:${NC}"
    echo -e "  View logs:        docker-compose logs -f"
    echo -e "  Stop services:    docker-compose down"
    echo -e "  Restart services: docker-compose restart"
    echo -e "  View status:      docker-compose ps"

    echo ""
}

# Main execution
main() {
    print_header "V2-Bucket Deployment Script"

    check_docker
    check_env
    validate_env
    cleanup
    deploy
    wait_for_services
    display_info

    print_success "Deployment completed successfully!"
}

# Run main function
main
```

---

## 8. QUICK_START.md (Root)

```markdown
# V2-Bucket Quick Start Guide

Deploy the entire V2-Bucket platform with ONE command!

## 🚀 Quick Deployment (3 Steps)

### Step 1: Clone & Navigate
\`\`\`bash
git clone <repository-url>
cd v2-bucket
\`\`\`

### Step 2: Configure Environment
\`\`\`bash
# Copy example environment file
cp .env.example .env

# Edit .env and change these values:
#   - POSTGRES_PASSWORD
#   - REDIS_PASSWORD
#   - JWT_SECRET
nano .env  # or use your favorite editor
\`\`\`

### Step 3: Deploy!
\`\`\`bash
# Make deploy script executable
chmod +x deploy.sh

# Deploy everything
./deploy.sh
\`\`\`

That's it! 🎉

## 📱 Access Your Platform

- **Web Dashboard**: http://localhost:3001
- **API Server**: http://localhost:3000
- **Default Login**: admin@v2bucket.com / admin123

## 🎯 What Gets Deployed

- ✅ PostgreSQL database (with migrations)
- ✅ Redis cache
- ✅ API server (backend)
- ✅ Web dashboard (frontend)
- ✅ Persistent storage volumes
- ✅ Health checks
- ✅ Automatic restarts

## 📝 Common Commands

\`\`\`bash
# View logs
docker-compose logs -f

# View specific service logs
docker-compose logs -f api
docker-compose logs -f web

# Stop all services
docker-compose down

# Stop and remove volumes (DELETES DATA!)
docker-compose down -v

# Restart services
docker-compose restart

# Check service status
docker-compose ps

# Rebuild and restart
docker-compose up -d --build
\`\`\`

## 🔧 Troubleshooting

### Services won't start
\`\`\`bash
# Check logs
docker-compose logs

# Check specific service
docker-compose logs api
\`\`\`

### Port already in use
Edit `.env` and change the ports:
\`\`\`env
API_PORT=3002
WEB_PORT=3003
\`\`\`

### Reset everything
\`\`\`bash
docker-compose down -v
./deploy.sh
\`\`\`

## 📚 Next Steps

- Read [README.md](README.md) for features
- Check [docs/API.md](docs/API.md) for API documentation
- See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for advanced deployment

## 🆘 Need Help?

- Check logs: `docker-compose logs -f`
- View health: `curl http://localhost:3000/health`
- Check status: `docker-compose ps`
\`\`\`
```

---

## ✅ Setup Instructions

1. **Create API Dockerfile**: ✅ Already created
2. **Create remaining files**: Copy content above into respective files
3. **Make deploy script executable**:
   ```bash
   chmod +x deploy.sh
   ```
4. **Deploy**:
   ```bash
   cp .env.example .env
   # Edit .env with your values
   ./deploy.sh
   ```

---

## 🎯 Final Result

After running `./deploy.sh`, you will have:

- ✅ Full V2-Bucket platform running
- ✅ Web dashboard at http://localhost:3001
- ✅ API server at http://localhost:3000
- ✅ PostgreSQL database (persistent)
- ✅ Redis cache (persistent)
- ✅ File storage (persistent)
- ✅ All services health-checked
- ✅ Automatic database migrations
- ✅ Everything configured via .env file

**ONE COMMAND DEPLOYMENT!** 🚀
