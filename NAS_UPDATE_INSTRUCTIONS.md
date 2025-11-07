# URGENT: Update docker-compose.yml on NAS

## The Problem
The `docker-compose.yml` file on your NAS is outdated. Docker uses the file from `/volume1/docker/v2-bucket/docker-compose.yml` on your NAS, NOT from GitHub!

## The Solution
You need to copy the updated `docker-compose.yml` from your development machine to your NAS.

### Method 1: Manual Copy (Easiest)

1. **On your development machine**, open this file:
   ```
   C:\Project\CineMaxPlaza\Synology S3 Bucket\v2-bucket\docker-compose.yml
   ```

2. **Copy the entire contents** of the file

3. **On your NAS**, edit the file:
   ```bash
   sudo nano /volume1/docker/v2-bucket/docker-compose.yml
   ```

4. **Delete all contents** and **paste** the new version

5. **Save** (Ctrl+O, Enter, Ctrl+X)

6. **Restart Docker**:
   ```bash
   cd /volume1/docker/v2-bucket
   sudo docker compose down
   sudo docker compose up -d
   ```

### Method 2: SCP Copy (Faster)

From your development machine (PowerShell/CMD):

```powershell
# Copy docker-compose.yml to NAS
scp "C:\Project\CineMaxPlaza\Synology S3 Bucket\v2-bucket\docker-compose.yml" vatsal-nas@YOUR_NAS_IP:/volume1/docker/v2-bucket/

# Then SSH to NAS and restart
ssh vatsal-nas@YOUR_NAS_IP
cd /volume1/docker/v2-bucket
sudo docker compose down
sudo docker compose up -d
```

### Method 3: Use Synology File Station

1. Open Synology DSM web interface
2. Go to File Station
3. Navigate to `docker/v2-bucket/`
4. Upload the `docker-compose.yml` from your dev machine
5. SSH to NAS and restart:
   ```bash
   cd /volume1/docker/v2-bucket
   sudo docker compose down
   sudo docker compose up -d
   ```

## Verify It's Working

After updating, check the logs:

```bash
sudo docker logs v2bucket-api --tail 50
```

You should see:
- ✅ "Installing packages (with dev dependencies for build)..."
- ✅ "Packages: +189" (WITHOUT "devDependencies: skipped")
- ✅ "Generating Prisma client..." (should succeed)
- ✅ "Building API..." (should succeed)

## Why This Happened

Docker Compose reads configuration from the `docker-compose.yml` file in the working directory on the NAS. It doesn't automatically pull this file from GitHub - only the source code goes into the builder container.

The `docker-compose.yml` file you updated on your dev machine needs to be manually copied to the NAS.
