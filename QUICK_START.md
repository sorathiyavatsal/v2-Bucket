# V2-Bucket Quick Start Guide

Get your V2-Bucket platform running in 3 simple steps.

---

## Prerequisites

- Docker 20.10+ installed
- Docker Compose 2.0+ installed
- 4GB+ RAM available
- 10GB+ storage space

---

## 3-Step Deployment

### Step 1: Configure Environment

```bash
# Copy environment template
cp .env.example .env

# Edit with your settings
nano .env  # or use any text editor
```

**Required changes:**
```env
POSTGRES_PASSWORD=your-strong-password-here
REDIS_PASSWORD=your-strong-password-here
JWT_SECRET=your-random-32-char-secret
BETTER_AUTH_SECRET=your-random-32-char-secret
```

**Generate strong secrets:**
```bash
# Linux/Mac:
openssl rand -base64 32

# Windows PowerShell:
[Convert]::ToBase64String((1..32|%{Get-Random -Min 0 -Max 256}))
```

### Step 2: Deploy with Script (Recommended)

```bash
# Make script executable (Linux/Mac/NAS)
chmod +x deploy.sh

# Run automated deployment
./deploy.sh
```

The script will:
- Check prerequisites
- Validate configuration
- Build Docker images
- Start all services
- Run health checks
- Display access information

**Or deploy manually:**

```bash
# Start all services
docker-compose up -d

# Check status
docker-compose ps

# View logs
docker-compose logs -f
```

### Step 3: Access Your Platform

**Web UI (Admin Dashboard):**
```
http://localhost:3001
```

**API Server:**
```
http://localhost:3000
```

**Health Check:**
```bash
curl http://localhost:3000/health
```

---

## First Login

1. Open Web UI: `http://localhost:3001`
2. Click "Create Account"
3. Register with your email
4. Login to dashboard

---

## Configure S3 Access

### Generate Access Keys

1. Login to Web UI
2. Go to "Access Keys" section
3. Click "Create New Key"
4. Save your Access Key ID and Secret Key

### Configure AWS CLI

```bash
aws configure --profile v2bucket
```

Enter:
- AWS Access Key ID: `<your-access-key-id>`
- AWS Secret Access Key: `<your-secret-key>`
- Default region: `us-east-1`
- Default output format: `json`

### Test S3 API

```bash
# List buckets
aws s3 ls --endpoint-url http://localhost:3000 --profile v2bucket

# Create bucket
aws s3 mb s3://my-bucket --endpoint-url http://localhost:3000 --profile v2bucket

# Upload file
echo "Hello World" > test.txt
aws s3 cp test.txt s3://my-bucket/ --endpoint-url http://localhost:3000 --profile v2bucket

# List objects
aws s3 ls s3://my-bucket/ --endpoint-url http://localhost:3000 --profile v2bucket

# Download file
aws s3 cp s3://my-bucket/test.txt downloaded.txt --endpoint-url http://localhost:3000 --profile v2bucket
```

---

## Useful Commands

### View Status
```bash
docker-compose ps
```

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

### Restart Services
```bash
docker-compose restart
```

### Update Application
```bash
git pull
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

---

## NAS-Specific Instructions

### Synology NAS

**Method 1: Container Manager (GUI)**
1. Install Container Manager from Package Center
2. Upload project to `/docker/v2-bucket`
3. Create project in Container Manager
4. Configure environment variables in GUI
5. Build and start

**Method 2: SSH**
```bash
ssh admin@synology-ip
sudo -i
cd /volume1/docker/v2-bucket
./deploy.sh
```

### QNAP NAS

**Method 1: Container Station (GUI)**
1. Install Container Station from App Center
2. Create Application
3. Upload `docker-compose.yml`
4. Configure environment variables
5. Create and start

**Method 2: SSH**
```bash
ssh admin@qnap-ip
cd /share/Container/v2-bucket
./deploy.sh
```

---

## Troubleshooting

### Check Service Status
```bash
docker-compose ps
```

### View Error Logs
```bash
docker-compose logs --tail=100 api
docker-compose logs --tail=100 web
```

### Restart Failed Service
```bash
docker-compose restart api
```

### Check Health
```bash
curl http://localhost:3000/health
curl http://localhost:3000/health/live
curl http://localhost:3000/health/ready
```

### Port Already in Use
Edit `.env` file:
```env
API_PORT=8080
WEB_PORT=8081
```

### Reset Everything
```bash
# WARNING: This deletes all data
docker-compose down -v
docker-compose up -d
```

---

## Production Deployment

For production deployment, update `.env`:

```env
# Use your domain
APP_URL=https://v2bucket.yourdomain.com
BETTER_AUTH_URL=https://api.yourdomain.com
NEXT_PUBLIC_API_URL=https://api.yourdomain.com
CORS_ORIGIN=https://v2bucket.yourdomain.com

# Enable HTTPS (use reverse proxy like Nginx/Traefik)

# Configure email for notifications
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password

# Add OAuth providers (optional)
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
```

---

## What's Next?

1. **Secure Your Installation**
   - Change default passwords
   - Enable HTTPS
   - Set up firewall rules

2. **Configure Backup**
   - Schedule automated backups
   - Test restore procedure
   - See [docs/NAS_DEPLOYMENT.md](docs/NAS_DEPLOYMENT.md#backup--restore)

3. **Customize Settings**
   - Configure storage quotas
   - Set up webhooks
   - Enable monitoring

4. **Read Full Documentation**
   - [README.md](README.md) - Project overview
   - [docs/NAS_DEPLOYMENT.md](docs/NAS_DEPLOYMENT.md) - Complete deployment guide
   - [docs/API.md](docs/API.md) - API reference
   - [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) - Advanced deployment options

---

## Get Help

- **Documentation**: See `docs/` folder
- **GitHub Issues**: Report bugs and request features
- **Community**: Join our discussion forum

---

**Your V2-Bucket platform is ready!** Start uploading files and managing your S3 storage.
