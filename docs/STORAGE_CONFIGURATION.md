# Storage Configuration Guide

This guide explains how V2-Bucket stores files and how to configure storage locations on your NAS.

## Overview

V2-Bucket uses **native filesystem storage** with an S3-compatible API. Files uploaded via the S3 API are stored directly on your NAS filesystem, making them easily accessible outside of Docker containers.

## Storage Architecture

```
┌─────────────────────────────────────────────┐
│           S3 API Client                     │
│     (AWS CLI, SDK, S3 Browser)              │
└──────────────────┬──────────────────────────┘
                   │ S3 API Calls
                   │
         ┌─────────▼──────────┐
         │   V2-Bucket API    │
         │   (Docker)         │
         └─────────┬──────────┘
                   │
         ┌─────────▼──────────┐
         │  /storage (inside) │
         │        ↕           │
         │  Bind Mount        │
         │        ↕           │
         │  NAS Filesystem    │
         │  /volume1/...      │
         └────────────────────┘
```

## Docker Volume Configuration

### Current Setup

The docker-compose.yml is configured to mount the storage directory from your NAS:

```yaml
services:
  api:
    volumes:
      # Mount storage directory from NAS filesystem
      - ${STORAGE_HOST_PATH:-./storage}:/storage
```

This creates a **bind mount** that maps a directory on your NAS to `/storage` inside the container.

### Configuration Variable

Set the `STORAGE_HOST_PATH` environment variable to specify where files should be stored on your NAS:

```env
# In .env file or environment
STORAGE_HOST_PATH=/volume1/docker/v2-bucket/storage
```

## NAS Storage Path Examples

### Synology NAS

```env
# Store in Docker folder
STORAGE_HOST_PATH=/volume1/docker/v2-bucket/storage

# Store in dedicated folder
STORAGE_HOST_PATH=/volume1/v2bucket-files

# Store on different volume
STORAGE_HOST_PATH=/volume2/backups/v2bucket
```

### QNAP NAS

```env
# Store in Container folder
STORAGE_HOST_PATH=/share/Container/v2-bucket/storage

# Store in Public share
STORAGE_HOST_PATH=/share/Public/v2bucket

# Store in specific share
STORAGE_HOST_PATH=/share/DataVol1/v2bucket
```

### Local Development

```env
# Relative to docker-compose.yml location
STORAGE_HOST_PATH=./storage

# Absolute path
STORAGE_HOST_PATH=/home/user/v2bucket/storage
```

## Directory Structure

Files are organized by bucket in the storage directory:

```
storage/
├── bucket1/
│   ├── file1.jpg
│   ├── folder1/
│   │   └── file2.pdf
│   └── folder2/
│       └── file3.txt
├── bucket2/
│   ├── image.png
│   └── docs/
│       └── report.docx
└── my-photos/
    ├── vacation.jpg
    └── family.jpg
```

### Example with Actual Path

If you set `STORAGE_HOST_PATH=/volume1/v2bucket-files`, your files will be stored as:

```
/volume1/v2bucket-files/
├── my-bucket/
│   ├── photo.jpg          # s3://my-bucket/photo.jpg
│   └── docs/
│       └── report.pdf     # s3://my-bucket/docs/report.pdf
└── backups/
    └── backup.tar.gz      # s3://backups/backup.tar.gz
```

## Setup Instructions

### Step 1: Choose Storage Location

Decide where you want to store files on your NAS:

```bash
# For Synology
STORAGE_PATH=/volume1/docker/v2-bucket/storage

# For QNAP
STORAGE_PATH=/share/Container/v2-bucket/storage
```

### Step 2: Create Directory (if needed)

SSH into your NAS and create the directory:

```bash
# Synology
sudo mkdir -p /volume1/docker/v2-bucket/storage
sudo chown -R 1000:1000 /volume1/docker/v2-bucket/storage

# QNAP
mkdir -p /share/Container/v2-bucket/storage
chown -R 1000:1000 /share/Container/v2-bucket/storage
```

### Step 3: Update .env File

```env
STORAGE_HOST_PATH=/volume1/docker/v2-bucket/storage
```

### Step 4: Restart Containers

```bash
cd /volume1/docker/v2-bucket
docker-compose down
docker-compose up -d
```

### Step 5: Verify Storage

Upload a test file and check it appears on the NAS:

```bash
# Upload via AWS CLI
aws s3 cp test.txt s3://my-bucket/ --endpoint-url http://localhost:3000

# Check on NAS
ls -la /volume1/docker/v2-bucket/storage/my-bucket/test.txt
```

## Accessing Files

### Via NAS File Manager

Your uploaded files are visible in the NAS file manager:

**Synology DSM:**
1. Open File Station
2. Navigate to the storage path (e.g., `/docker/v2-bucket/storage`)
3. Browse buckets and files

**QNAP QTS:**
1. Open File Station
2. Navigate to the storage path (e.g., `/Container/v2-bucket/storage`)
3. Browse buckets and files

### Via Network Share

Share the storage folder over SMB/NFS:

**Synology:**
1. Control Panel → Shared Folder → Create
2. Name: `v2bucket`
3. Location: `/volume1/docker/v2-bucket/storage`
4. Enable SMB/NFS access

**Access from Windows:**
```
\\synology-ip\v2bucket
```

**Access from Mac/Linux:**
```
smb://synology-ip/v2bucket
```

### Direct Shell Access

```bash
# SSH into NAS
ssh admin@nas-ip

# Navigate to storage
cd /volume1/docker/v2-bucket/storage

# List buckets
ls -la

# View bucket contents
ls -la my-bucket/
```

## File Permissions

The API container runs as user ID 1000. Ensure the storage directory has correct permissions:

```bash
# On NAS (via SSH)
sudo chown -R 1000:1000 /volume1/docker/v2-bucket/storage
sudo chmod -R 755 /volume1/docker/v2-bucket/storage
```

If you encounter permission errors:

```bash
# Check current permissions
ls -la /volume1/docker/v2-bucket/

# Fix ownership
sudo chown -R 1000:1000 /volume1/docker/v2-bucket/storage

# Fix permissions
sudo find /volume1/docker/v2-bucket/storage -type d -exec chmod 755 {} \;
sudo find /volume1/docker/v2-bucket/storage -type f -exec chmod 644 {} \;
```

## Storage Limits

Configure storage quotas in the V2-Bucket dashboard:

1. Login to web dashboard
2. Go to **Settings** → **Storage**
3. Set per-user quotas
4. Set per-bucket size limits

## Backup Recommendations

Since files are stored directly on the NAS, use your NAS's built-in backup features:

**Synology:**
- Hyper Backup for cloud backups
- Snapshot Replication for local snapshots
- Rsync for remote backups

**QNAP:**
- Hybrid Backup Sync for cloud backups
- Snapshot for local snapshots
- Rsync for remote backups

### Manual Backup

```bash
# Tar backup
tar -czf v2bucket-backup-$(date +%Y%m%d).tar.gz /volume1/docker/v2-bucket/storage

# Rsync to remote location
rsync -avz /volume1/docker/v2-bucket/storage/ user@backup-server:/backups/v2bucket/
```

## Monitoring Storage Usage

### Via Dashboard

The V2-Bucket dashboard shows:
- Total storage used
- Per-bucket storage
- Per-user storage
- Storage quota status

### Via NAS

```bash
# Check disk usage
df -h /volume1

# Check storage directory size
du -sh /volume1/docker/v2-bucket/storage

# Check each bucket size
du -sh /volume1/docker/v2-bucket/storage/*
```

### Via Docker

```bash
# Check from Docker host
docker exec v2bucket-api du -sh /storage

# Check per bucket
docker exec v2bucket-api du -sh /storage/*
```

## Troubleshooting

### Files Not Appearing on NAS

**Check mount status:**
```bash
docker exec v2bucket-api ls -la /storage
```

**Verify bind mount:**
```bash
docker inspect v2bucket-api | grep -A 10 Mounts
```

### Permission Denied Errors

**Fix ownership:**
```bash
sudo chown -R 1000:1000 /volume1/docker/v2-bucket/storage
```

**Check container user:**
```bash
docker exec v2bucket-api id
```

### Storage Path Not Found

**Create directory:**
```bash
sudo mkdir -p /volume1/docker/v2-bucket/storage
sudo chown 1000:1000 /volume1/docker/v2-bucket/storage
```

**Verify .env setting:**
```bash
grep STORAGE_HOST_PATH .env
```

## Migrating Storage Location

To move files to a new location:

```bash
# Stop containers
docker-compose down

# Copy files to new location
sudo rsync -av /old/path/storage/ /new/path/storage/

# Update .env
nano .env
# Change: STORAGE_HOST_PATH=/new/path/storage

# Fix permissions
sudo chown -R 1000:1000 /new/path/storage

# Start containers
docker-compose up -d

# Verify
docker exec v2bucket-api ls -la /storage
```

## Performance Considerations

### SSD vs HDD

- Use SSD for better IOPS (frequently accessed files)
- Use HDD for cost-effective bulk storage
- Consider SSD cache on Synology/QNAP

### Network Storage

Avoid mounting network shares (NFS/SMB) as the storage path:
- Increases latency
- Reduces throughput
- May cause permission issues

Use local disks for best performance.

### RAID Configuration

Recommended RAID levels for storage:
- **RAID 1** - Mirroring (best reliability)
- **RAID 5** - Striping with parity (good balance)
- **RAID 6** - Double parity (better reliability)
- **RAID 10** - Striped mirrors (best performance)

## Support

For storage-related issues:
1. Check Docker logs: `docker-compose logs api`
2. Verify permissions: `ls -la /volume1/docker/v2-bucket/storage`
3. Check disk space: `df -h`
4. Review this guide
5. Open issue on GitHub

---

**Last Updated:** 2025-01-11
**Version:** 1.0.0
