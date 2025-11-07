# Deploy V2-Bucket on NAS from GitHub

Deploy V2-Bucket on your NAS by pulling code directly from your GitHub repository. No need to clone the repo manually!

---

## What You Need

1. Your GitHub repository URL
2. Docker installed on your NAS
3. 2 files: `docker-compose.production.yml` and `.env`

---

## Quick Deployment (3 Steps)

### Step 1: Copy Files to NAS

Copy these 2 files to your NAS:
- `docker-compose.production.yml`
- `.env.production.example` (rename to `.env`)

**On Synology NAS:**
```
/volume1/docker/v2-bucket/
├── docker-compose.production.yml
└── .env
```

**On QNAP NAS:**
```
/share/Container/v2-bucket/
├── docker-compose.production.yml
└── .env
```

### Step 2: Configure .env File

Edit `.env` file on your NAS:

```env
# Your GitHub repository
GIT_REPO=https://github.com/yourusername/v2-bucket.git
GIT_BRANCH=main

# Database password
POSTGRES_PASSWORD=your-strong-password-here

# Redis password
REDIS_PASSWORD=your-strong-password-here

# JWT secrets (generate with: openssl rand -base64 32)
JWT_SECRET=your-random-32-char-secret
BETTER_AUTH_SECRET=your-random-32-char-secret

# Your NAS IP address (change this!)
APP_URL=http://192.168.1.100:3001
BETTER_AUTH_URL=http://192.168.1.100:3000
NEXT_PUBLIC_API_URL=http://192.168.1.100:3000
CORS_ORIGIN=http://192.168.1.100:3001
```

### Step 3: Deploy

**Via SSH:**
```bash
# Navigate to folder
cd /volume1/docker/v2-bucket

# Start deployment
docker compose -f docker-compose.production.yml up -d

# Watch logs
docker compose -f docker-compose.production.yml logs -f
```

**Via Synology Container Manager:**
1. Open Container Manager
2. Go to "Project" tab
3. Click "Create"
4. Select `docker-compose.production.yml`
5. Configure environment variables
6. Click "Deploy"

**Via QNAP Container Station:**
1. Open Container Station
2. Click "Create Application"
3. Upload `docker-compose.production.yml`
4. Configure environment variables
5. Click "Create"

---

## How It Works

When you run `docker compose up`:

1. **Builder container** clones your GitHub repo
2. **API container** installs dependencies, builds code, and starts server
3. **Web container** installs dependencies, builds UI, and starts frontend
4. **PostgreSQL** and **Redis** start automatically

Everything is automatic - no manual git clone needed!

---

## First Time Deployment

First deployment takes **10-15 minutes** because it needs to:
- Clone repository
- Install all dependencies
- Build TypeScript code
- Run database migrations
- Start all services

**Subsequent deployments** are faster (2-3 minutes) because code is cached.

---

## Access Your Platform

After deployment completes:

- **Web UI**: http://your-nas-ip:3001
- **API**: http://your-nas-ip:3000
- **Health Check**: http://your-nas-ip:3000/health

---

## Update to Latest Code

To pull latest changes from GitHub and redeploy:

```bash
# Stop containers
docker compose -f docker-compose.production.yml down

# Remove builder to force fresh clone
docker compose -f docker-compose.production.yml rm builder

# Start again (will pull latest code)
docker compose -f docker-compose.production.yml up -d
```

Or simply restart the builder service:

```bash
docker compose -f docker-compose.production.yml restart builder api web
```

---

## Using Private GitHub Repository

If your repository is private, you have two options:

### Option 1: Personal Access Token (HTTPS)

1. **Generate GitHub Token:**
   - Go to GitHub → Settings → Developer settings → Personal access tokens
   - Generate new token with `repo` access
   - Copy the token

2. **Update GIT_REPO in .env:**
   ```env
   GIT_REPO=https://YOUR_TOKEN@github.com/yourusername/v2-bucket.git
   ```

### Option 2: SSH Key (Recommended)

1. **Generate SSH key on NAS:**
   ```bash
   ssh-keygen -t ed25519 -C "your-email@example.com"
   cat ~/.ssh/id_ed25519.pub
   ```

2. **Add SSH key to GitHub:**
   - Go to GitHub → Settings → SSH and GPG keys
   - Add new SSH key
   - Paste the public key

3. **Update GIT_REPO in .env:**
   ```env
   GIT_REPO=git@github.com:yourusername/v2-bucket.git
   ```

4. **Accept GitHub's SSH fingerprint:**
   ```bash
   ssh -T git@github.com
   ```

---

## Useful Commands

### View Logs
```bash
# All services
docker compose -f docker-compose.production.yml logs -f

# Specific service
docker compose -f docker-compose.production.yml logs -f api
docker compose -f docker-compose.production.yml logs -f web
docker compose -f docker-compose.production.yml logs -f builder
```

### Check Status
```bash
docker compose -f docker-compose.production.yml ps
```

### Stop Services
```bash
docker compose -f docker-compose.production.yml down
```

### Restart Services
```bash
docker compose -f docker-compose.production.yml restart
```

### View Build Progress
```bash
docker compose -f docker-compose.production.yml logs -f builder
```

### Remove Everything (Fresh Start)
```bash
# WARNING: This deletes all data!
docker compose -f docker-compose.production.yml down -v
```

---

## Troubleshooting

### Build is Taking Too Long

The first build can take 10-15 minutes. Be patient!

Check progress:
```bash
docker compose -f docker-compose.production.yml logs -f builder
docker compose -f docker-compose.production.yml logs -f api
```

### Git Clone Failed

**Error**: "repository not found" or "authentication failed"

**Solution**:
- Check GIT_REPO URL is correct
- For private repos, use access token or SSH key
- Test git clone manually: `git clone YOUR_REPO_URL`

### API Won't Start

**Error**: API container keeps restarting

**Solution**:
```bash
# Check logs
docker compose -f docker-compose.production.yml logs api

# Common issues:
# 1. Database password incorrect
# 2. JWT_SECRET not set
# 3. Build failed - check builder logs
```

### Web UI Won't Load

**Error**: Cannot access http://nas-ip:3001

**Solution**:
1. Check API is running first (API must be healthy for Web to start)
2. Check logs: `docker compose logs web`
3. Verify NEXT_PUBLIC_API_URL points to correct API address

### Permission Denied

**Error**: Cannot write to /storage

**Solution**:
```bash
# Create storage directory with correct permissions
mkdir -p /volume1/docker/v2-bucket/storage
chmod 777 /volume1/docker/v2-bucket/storage
```

---

## Configuration Examples

### Example 1: Synology NAS with Local IP

```env
GIT_REPO=https://github.com/yourusername/v2-bucket.git
GIT_BRANCH=main
POSTGRES_PASSWORD=MySecurePassword123!
REDIS_PASSWORD=AnotherSecurePassword456!
JWT_SECRET=c3VwZXItc2VjcmV0LWp3dC1rZXktMzItY2hhcnM=
BETTER_AUTH_SECRET=YW5vdGhlci1zdXBlci1zZWNyZXQta2V5LTMyLWNoYXJz
APP_URL=http://192.168.1.100:3001
BETTER_AUTH_URL=http://192.168.1.100:3000
NEXT_PUBLIC_API_URL=http://192.168.1.100:3000
CORS_ORIGIN=http://192.168.1.100:3001
```

### Example 2: QNAP NAS with Domain

```env
GIT_REPO=git@github.com:yourusername/v2-bucket.git
GIT_BRANCH=main
POSTGRES_PASSWORD=MySecurePassword123!
REDIS_PASSWORD=AnotherSecurePassword456!
JWT_SECRET=c3VwZXItc2VjcmV0LWp3dC1rZXktMzItY2hhcnM=
BETTER_AUTH_SECRET=YW5vdGhlci1zdXBlci1zZWNyZXQta2V5LTMyLWNoYXJz
APP_URL=https://v2bucket.mydomain.com
BETTER_AUTH_URL=https://api.mydomain.com
NEXT_PUBLIC_API_URL=https://api.mydomain.com
CORS_ORIGIN=https://v2bucket.mydomain.com
```

### Example 3: Private Repository with Token

```env
GIT_REPO=https://ghp_YourPersonalAccessToken123456@github.com/yourusername/v2-bucket.git
GIT_BRANCH=production
# ... rest of config
```

---

## Synology Container Manager GUI Setup

If you prefer using the GUI instead of SSH:

1. **Upload Files:**
   - Use File Station to upload files to `/docker/v2-bucket/`
   - Upload: `docker-compose.production.yml` and `.env`

2. **Create Project:**
   - Open Container Manager
   - Go to "Project" tab
   - Click "Create"
   - Name: `v2-bucket`
   - Path: `/docker/v2-bucket`
   - Select `docker-compose.production.yml`

3. **Configure Environment:**
   - Click "Environment" tab
   - Edit variables or upload `.env` file

4. **Deploy:**
   - Click "Next" → "Done"
   - Project will start building
   - View logs in "Container" tab

5. **Monitor:**
   - Check "Container" tab for running status
   - View logs by clicking container name

---

## QNAP Container Station GUI Setup

1. **Upload Files:**
   - Use File Station to upload to `/Container/v2-bucket/`
   - Upload: `docker-compose.production.yml` and `.env`

2. **Create Application:**
   - Open Container Station
   - Click "+ Create Application"
   - Name: `v2-bucket`
   - Upload `docker-compose.production.yml`

3. **Configure:**
   - Edit environment variables
   - Or import `.env` file

4. **Create:**
   - Click "Validate" to check configuration
   - Click "Create" to deploy

5. **Monitor:**
   - Check application status in Container Station
   - View logs by clicking application

---

## Security Best Practices

1. **Use Strong Passwords:**
   ```bash
   # Generate secure passwords
   openssl rand -base64 32
   ```

2. **Restrict Git Access:**
   - Use SSH keys instead of tokens when possible
   - Never commit .env file to repository
   - Use deploy keys with read-only access

3. **Network Security:**
   - Use firewall to restrict ports
   - Use HTTPS with reverse proxy
   - Restrict CORS to your domain only

4. **Regular Updates:**
   - Pull latest code regularly
   - Monitor GitHub for security updates
   - Update dependencies periodically

---

## Next Steps

1. **Access Web UI** at http://your-nas-ip:3001
2. **Create Admin Account**
3. **Generate S3 Access Keys**
4. **Configure AWS CLI**
5. **Test File Uploads**

---

## Support

Need help? Check:
- Logs: `docker compose logs -f`
- Health: `curl http://your-nas-ip:3000/health`
- Documentation: `docs/` folder in repository

---

**Your V2-Bucket platform is ready to deploy from GitHub!**
