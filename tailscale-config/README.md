# Tailscale Configuration for v2-Bucket

## Setup Instructions

### 1. Get Tailscale Auth Key

1. Go to https://login.tailscale.com/admin/settings/keys
2. Click "Generate auth key"
3. Enable these options:
   - ✅ Reusable
   - ✅ Ephemeral (optional)
   - Set expiration as needed
4. Copy the generated key (starts with `tskey-auth-`)

### 2. Update docker-compose.yml

The auth key is already configured in the `TS_AUTHKEY` environment variable.
If you need to change it, update line 26 in docker-compose.yml

### 3. Start Tailscale Container

```bash
cd /volume1/docker/v2-bucket
docker-compose up -d tailscale
```

### 4. Verify Tailscale is Running

```bash
# Check container status
docker-compose ps tailscale

# Check Tailscale status
docker exec v2bucket-tailscale tailscale status
```

### 5. Enable Serve and Funnel

After the container is running, configure serve and funnel:

```bash
# Enable serve for web UI
docker exec v2bucket-tailscale tailscale serve --bg --https=443 / http://127.0.0.1:3001

# Enable serve for API
docker exec v2bucket-tailscale tailscale serve --bg --https=443 /api http://127.0.0.1:3000

# Enable Funnel (public access)
docker exec v2bucket-tailscale tailscale funnel --bg 443 on

# Check status
docker exec v2bucket-tailscale tailscale serve status
```

### 6. Access Your Application

**Public URL (anyone can access):**
```
https://v2bucket.tail87f856.ts.net
```

**API Endpoint:**
```
https://v2bucket.tail87f856.ts.net/api
```

## Troubleshooting

### Check Tailscale Logs
```bash
docker logs v2bucket-tailscale
```

### Reset Serve Configuration
```bash
docker exec v2bucket-tailscale tailscale serve reset
```

### Restart Tailscale Container
```bash
docker-compose restart tailscale
```

## serve.json Configuration

The `serve.json` file configures:
- Web UI on `/` → http://127.0.0.1:3001
- API on `/api/` → http://127.0.0.1:3000
- Funnel enabled for public access on port 443

This configuration is automatically loaded when the container starts.
