# V2-Bucket NAS Deployment Guide

Complete guide for deploying V2-Bucket platform on Synology NAS, QNAP NAS, or any server with Docker support.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Quick Start (3 Steps)](#quick-start-3-steps)
3. [Synology NAS Deployment](#synology-nas-deployment)
4. [QNAP NAS Deployment](#qnap-nas-deployment)
5. [Generic Linux Server](#generic-linux-server)
6. [Configuration](#configuration)
7. [Accessing Your Services](#accessing-your-services)
8. [Troubleshooting](#troubleshooting)
9. [Maintenance](#maintenance)
10. [Backup & Restore](#backup--restore)

---

## Prerequisites

### Required Software
- **Docker** version 20.10 or higher
- **Docker Compose** version 2.0 or higher
- **Git** (optional, for cloning repository)

### System Requirements
- **CPU**: 2+ cores recommended
- **RAM**: 4GB minimum, 8GB recommended
- **Storage**: 10GB for application + your data storage needs
- **Network**: Static IP or domain name recommended

---

## Quick Start (3 Steps)

### Step 1: Download Project

```bash
# Option A: Using git
git clone https://github.com/yourusername/v2-bucket.git
cd v2-bucket

# Option B: Download ZIP
# Extract the ZIP file and navigate to the folder
cd v2-bucket
```

### Step 2: Configure Environment

```bash
# Copy environment template
cp .env.example .env

# Edit .env file with your settings
nano .env  # or use any text editor
```

**Minimum required changes in `.env`:**
```env
# Change these passwords!
POSTGRES_PASSWORD=your-strong-postgres-password-here
REDIS_PASSWORD=your-strong-redis-password-here
JWT_SECRET=your-jwt-secret-here
BETTER_AUTH_SECRET=your-better-auth-secret-here
```

**Generate strong secrets:**
```bash
# On Linux/Mac:
openssl rand -base64 32

# On Windows PowerShell:
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Minimum 0 -Maximum 256 }))
```

### Step 3: Deploy

```bash
# Start all services
docker-compose up -d

# Check status
docker-compose ps

# View logs
docker-compose logs -f
```

**That's it!** Your V2-Bucket platform is now running.

Access at:
- **Web UI**: http://your-nas-ip:3001
- **API**: http://your-nas-ip:3000

---

## Synology NAS Deployment

### Method 1: Using Container Manager (Recommended)

1. **Install Container Manager**
   - Open Package Center
   - Search for "Container Manager"
   - Click Install

2. **Prepare Files**
   - Upload project folder to `/docker/v2-bucket` using File Station
   - Or use SSH and git clone

3. **Create Project**
   - Open Container Manager
   - Go to "Project" tab
   - Click "Create"
   - Set Project Name: `v2-bucket`
   - Set Path: `/docker/v2-bucket`
   - Select `docker-compose.yml`
   - Configure environment variables via Web UI
   - Click "Next" and "Done"

4. **Start Services**
   - In Container Manager, select your project
   - Click "Build" (first time only)
   - Click "Start"

### Method 2: Using SSH

1. **Enable SSH**
   - Control Panel → Terminal & SNMP
   - Enable SSH service

2. **Connect via SSH**
   ```bash
   ssh admin@your-nas-ip
   sudo -i  # Enter your admin password
   ```

3. **Navigate and Deploy**
   ```bash
   cd /volume1/docker/v2-bucket
   docker-compose up -d
   ```

### Synology-Specific Notes

**Port Forwarding:**
- Control Panel → Login Portal → Advanced
- Set up reverse proxy if needed:
  - Source: `subdomain.yourdomain.com:443`
  - Destination: `localhost:3001`

**Firewall:**
- Control Panel → Security → Firewall
- Allow ports 3000 and 3001 (or use reverse proxy)

**Auto-Start:**
- Container Manager automatically starts containers on boot
- Or create Task Scheduler task:
  - Control Panel → Task Scheduler
  - Create: Triggered Task → Boot-up
  - User: root
  - Command: `cd /volume1/docker/v2-bucket && docker-compose up -d`

---

## QNAP NAS Deployment

### Using Container Station

1. **Install Container Station**
   - Open App Center
   - Search for "Container Station"
   - Click Install

2. **Create Application**
   - Open Container Station
   - Click "Create Application"
   - Enter Application Name: `v2-bucket`
   - Upload or paste `docker-compose.yml`
   - Configure environment variables
   - Click "Validate" then "Create"

3. **Start Services**
   - Find your application in the list
   - Click "Play" button

### Using SSH

```bash
# Connect to QNAP
ssh admin@your-qnap-ip

# Navigate to project
cd /share/Container/v2-bucket

# Deploy
docker-compose up -d
```

### QNAP-Specific Notes

**Shared Folder:**
- Create a shared folder for data: `/share/v2bucket-data`
- Mount it in docker-compose.yml:
  ```yaml
  volumes:
    - /share/v2bucket-data:/storage
  ```

**Network Settings:**
- Network & File Services → Network Settings
- Enable port forwarding if needed

**Auto-Start:**
- Container Station auto-starts containers
- Or use systemd service (for advanced users)

---

## Generic Linux Server

### Ubuntu/Debian

```bash
# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Install Docker Compose
sudo apt-get update
sudo apt-get install docker-compose-plugin

# Clone and deploy
git clone https://github.com/yourusername/v2-bucket.git
cd v2-bucket
cp .env.example .env
nano .env  # Configure your settings
docker compose up -d
```

### CentOS/RHEL

```bash
# Install Docker
sudo yum install -y yum-utils
sudo yum-config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo
sudo yum install docker-ce docker-ce-cli containerd.io docker-compose-plugin

# Start Docker
sudo systemctl start docker
sudo systemctl enable docker

# Deploy
cd /opt
sudo git clone https://github.com/yourusername/v2-bucket.git
cd v2-bucket
sudo cp .env.example .env
sudo nano .env
sudo docker compose up -d
```

### Enable Auto-Start (systemd)

Create `/etc/systemd/system/v2bucket.service`:

```ini
[Unit]
Description=V2-Bucket Platform
Requires=docker.service
After=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/opt/v2-bucket
ExecStart=/usr/bin/docker compose up -d
ExecStop=/usr/bin/docker compose down
TimeoutStartSec=0

[Install]
WantedBy=multi-user.target
```

Enable and start:
```bash
sudo systemctl enable v2bucket
sudo systemctl start v2bucket
```

---

## Configuration

### Environment Variables

**Required Variables:**

```env
# Database
POSTGRES_PASSWORD=<generate-strong-password>

# Cache
REDIS_PASSWORD=<generate-strong-password>

# Authentication
JWT_SECRET=<generate-32-char-secret>
BETTER_AUTH_SECRET=<generate-32-char-secret>
```

**Optional But Recommended:**

```env
# Custom URLs (for production)
APP_URL=https://yourdomain.com
BETTER_AUTH_URL=https://api.yourdomain.com
NEXT_PUBLIC_API_URL=https://api.yourdomain.com
CORS_ORIGIN=https://yourdomain.com

# Email (for notifications)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
SMTP_FROM=noreply@yourdomain.com

# OAuth (for social login)
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
```

### Port Customization

If default ports are occupied, change them in `.env`:

```env
API_PORT=8080
WEB_PORT=8081
POSTGRES_PORT=5433
REDIS_PORT=6380
```

### Storage Configuration

By default, storage is in Docker volumes. To use custom path:

**Synology:**
```yaml
volumes:
  - /volume1/v2bucket-storage:/storage
```

**QNAP:**
```yaml
volumes:
  - /share/v2bucket-storage:/storage
```

**Linux:**
```yaml
volumes:
  - /mnt/data/v2bucket-storage:/storage
```

---

## Accessing Your Services

### Web UI (Admin Dashboard)
```
http://your-nas-ip:3001
```

Default admin account:
- Email: `admin@example.com`
- Password: Create on first login

### API Server
```
http://your-nas-ip:3000
```

Health check:
```bash
curl http://your-nas-ip:3000/health
```

### S3-Compatible API

Configure AWS CLI:
```bash
aws configure --profile v2bucket
AWS Access Key ID: <your-access-key>
AWS Secret Access Key: <your-secret-key>
Default region name: us-east-1
Default output format: json
```

Test S3 API:
```bash
# List buckets
aws s3 ls --endpoint-url http://your-nas-ip:3000 --profile v2bucket

# Create bucket
aws s3 mb s3://test-bucket --endpoint-url http://your-nas-ip:3000 --profile v2bucket

# Upload file
aws s3 cp file.txt s3://test-bucket/ --endpoint-url http://your-nas-ip:3000 --profile v2bucket
```

---

## Troubleshooting

### Check Service Status

```bash
# View all containers
docker-compose ps

# View logs for specific service
docker-compose logs api
docker-compose logs web
docker-compose logs postgres
docker-compose logs redis

# Follow logs in real-time
docker-compose logs -f api
```

### Common Issues

**Issue: Port already in use**
```bash
# Check what's using the port
sudo netstat -tulpn | grep :3000

# Change port in .env file
API_PORT=8080
```

**Issue: Database connection failed**
```bash
# Check PostgreSQL is running
docker-compose ps postgres

# Check logs
docker-compose logs postgres

# Restart database
docker-compose restart postgres
```

**Issue: Permission denied on storage**
```bash
# Fix permissions (Linux/NAS)
sudo chown -R 1001:1001 /path/to/storage

# Or in docker-compose.yml
volumes:
  - type: bind
    source: /path/to/storage
    target: /storage
    volume:
      nocopy: true
```

**Issue: Cannot access Web UI**
```bash
# Check if web container is running
docker-compose ps web

# Check logs
docker-compose logs web

# Test API connection from web container
docker-compose exec web curl http://api:3000/health
```

### Reset Everything

```bash
# Stop all services
docker-compose down

# Remove volumes (WARNING: Deletes all data!)
docker-compose down -v

# Remove images
docker-compose down --rmi all

# Start fresh
docker-compose up -d
```

---

## Maintenance

### Update Application

```bash
# Pull latest changes
git pull

# Rebuild and restart
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

### Database Migrations

Migrations run automatically on startup. To run manually:

```bash
docker-compose exec api pnpm prisma migrate deploy
```

### View Container Resource Usage

```bash
docker stats
```

### Clean Up Unused Resources

```bash
# Remove stopped containers
docker container prune

# Remove unused images
docker image prune

# Remove unused volumes
docker volume prune

# Remove everything unused
docker system prune -a
```

---

## Backup & Restore

### Backup

**Method 1: Docker Volumes**

```bash
# Stop services
docker-compose down

# Backup volumes
docker run --rm \
  -v v2bucket-postgres-data:/data \
  -v $(pwd)/backups:/backup \
  alpine tar czf /backup/postgres-$(date +%Y%m%d).tar.gz -C /data .

docker run --rm \
  -v v2bucket-storage-data:/data \
  -v $(pwd)/backups:/backup \
  alpine tar czf /backup/storage-$(date +%Y%m%d).tar.gz -C /data .

# Start services
docker-compose up -d
```

**Method 2: PostgreSQL Dump**

```bash
# Create backup directory
mkdir -p backups

# Dump database
docker-compose exec -T postgres pg_dump -U v2bucket v2bucket > backups/database-$(date +%Y%m%d).sql

# Backup storage directory
tar czf backups/storage-$(date +%Y%m%d).tar.gz /path/to/storage
```

**Automated Backup Script** (`backup.sh`):

```bash
#!/bin/bash
BACKUP_DIR="/volume1/backups/v2bucket"
DATE=$(date +%Y%m%d-%H%M%S)

mkdir -p $BACKUP_DIR

# Database backup
docker-compose exec -T postgres pg_dump -U v2bucket v2bucket | gzip > $BACKUP_DIR/db-$DATE.sql.gz

# Storage backup
docker run --rm -v v2bucket-storage-data:/data -v $BACKUP_DIR:/backup alpine tar czf /backup/storage-$DATE.tar.gz -C /data .

# Keep only last 7 days
find $BACKUP_DIR -name "*.gz" -mtime +7 -delete

echo "Backup completed: $DATE"
```

Make executable and schedule:
```bash
chmod +x backup.sh

# Add to crontab (daily at 2 AM)
crontab -e
0 2 * * * /volume1/docker/v2-bucket/backup.sh
```

### Restore

**From Volume Backup:**

```bash
# Stop services
docker-compose down

# Restore postgres volume
docker run --rm \
  -v v2bucket-postgres-data:/data \
  -v $(pwd)/backups:/backup \
  alpine sh -c "cd /data && tar xzf /backup/postgres-20250120.tar.gz"

# Restore storage volume
docker run --rm \
  -v v2bucket-storage-data:/data \
  -v $(pwd)/backups:/backup \
  alpine sh -c "cd /data && tar xzf /backup/storage-20250120.tar.gz"

# Start services
docker-compose up -d
```

**From SQL Dump:**

```bash
# Stop services
docker-compose down

# Start only database
docker-compose up -d postgres

# Wait for database to be ready
sleep 10

# Restore database
cat backups/database-20250120.sql | docker-compose exec -T postgres psql -U v2bucket v2bucket

# Start all services
docker-compose up -d
```

---

## Security Best Practices

1. **Change Default Passwords**: Update all passwords in `.env`
2. **Use Strong Secrets**: Generate random 32+ character secrets
3. **Enable HTTPS**: Use reverse proxy with SSL certificates
4. **Firewall**: Only expose necessary ports
5. **Regular Updates**: Keep Docker and application updated
6. **Regular Backups**: Automate daily backups
7. **Restrict Access**: Use strong authentication and access keys
8. **Monitor Logs**: Regularly check logs for suspicious activity

---

## Getting Help

- **Documentation**: See `docs/` folder
- **GitHub Issues**: https://github.com/yourusername/v2-bucket/issues
- **Community Forum**: https://community.v2bucket.com

---

**Deployment completed successfully!** Your V2-Bucket platform is now running on your NAS.
