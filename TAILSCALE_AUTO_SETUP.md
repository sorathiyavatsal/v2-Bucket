# Tailscale Automatic Configuration

The V2-Bucket docker-compose.yml is configured to automatically set up Tailscale Serve and Funnel when containers start.

## 🚀 Automatic Setup

When you run `docker-compose up -d`, the Tailscale container will automatically:

1. ✅ Start Tailscale daemon
2. ✅ Connect to Tailscale network using auth key
3. ✅ Wait for API and Web containers to be healthy
4. ✅ Configure Serve for Web UI at root path (`/`)
5. ✅ Configure Serve for API at `/api` path
6. ✅ Enable Funnel for public HTTPS access
7. ✅ Display final configuration

**No manual commands needed!** 🎉

## 📋 What Gets Configured

```
https://v2bucket.discus-likert.ts.net (Funnel on)
|-- / → http://127.0.0.1:3001 (Web Dashboard)
|-- /api → http://127.0.0.1:3000 (API Server - preserves /api prefix)
|-- /health → http://127.0.0.1:3000 (Health Check)
|-- /metrics → http://127.0.0.1:3000 (Metrics)
```

## 🔧 How It Works

### Dependency Chain

```
postgres → builder → api → web → tailscale
                     ↓      ↓
                  healthy  healthy → auto-configure
```

The Tailscale container:
- Waits for API and Web to be healthy
- Automatically configures Serve and Funnel
- Logs all configuration steps
- Continues running to maintain Tailscale connection

### Configuration Script

The docker-compose.yml includes an embedded script that:

```bash
# Start Tailscale daemon in background
tailscaled &

# Authenticate with Tailscale network
tailscale up --authkey=... --hostname=v2bucket

# Wait for services to be ready
sleep 10

# Reset any existing configuration
tailscale serve reset

# Configure serve (automatically uses HTTPS on port 443)
# Serve Web UI on root path (no path argument)
tailscale serve --bg http://127.0.0.1:3001

# Add API routes with set-path
tailscale serve --set-path=/api --bg http://127.0.0.1:3000
tailscale serve --set-path=/health --bg http://127.0.0.1:3000
tailscale serve --set-path=/metrics --bg http://127.0.0.1:3000

# Enable public access (funnel) on port 443
tailscale funnel --bg 443 on

# Show configuration
tailscale serve status
```

## 📊 Viewing Configuration

Check the automatic configuration:

```bash
# View Tailscale logs
docker logs v2bucket-tailscale

# Check serve status
docker exec v2bucket-tailscale tailscale serve status

# Check funnel status
docker exec v2bucket-tailscale tailscale funnel status
```

## 🔄 Restart Behavior

When containers restart:

1. Tailscale reconnects automatically
2. Serve and Funnel configuration is persistent (stored in volume)
3. If configuration exists, commands succeed without changes
4. If configuration is missing, it's recreated automatically

## 🛠️ Manual Override

If you need to change configuration:

```bash
# Reset serve configuration
docker exec v2bucket-tailscale tailscale serve reset

# Disable funnel
docker exec v2bucket-tailscale tailscale funnel off

# Restart container to reconfigure
docker-compose restart tailscale
```

## ⚙️ Customizing Configuration

To change Tailscale settings, edit `docker-compose.yml`:

### Change Hostname

```yaml
environment:
  - TS_HOSTNAME=my-custom-name
```

Then in the command section, update:
```bash
tailscale up --authkey=${TS_AUTHKEY} --hostname=my-custom-name
```

### Change Ports

If your API or Web run on different ports:

```bash
# Reset existing config
tailscale serve reset

# Configure with custom ports
tailscale serve --bg http://127.0.0.1:8080
tailscale serve --set-path=/api --bg http://127.0.0.1:4000
tailscale serve --set-path=/health --bg http://127.0.0.1:4000
tailscale serve --set-path=/metrics --bg http://127.0.0.1:4000

# Enable funnel on port 443
tailscale funnel --bg 443 on
```

### Disable Auto-Configuration

Remove the `depends_on` section and change command back to:

```yaml
command: tailscaled
```

Then configure manually as before.

## 🆘 Troubleshooting

### Tailscale Not Connecting

**Check logs:**
```bash
docker logs v2bucket-tailscale --tail 50
```

**Common issues:**
- Auth key expired → Generate new key at https://login.tailscale.com/admin/settings/keys
- Network issues → Check firewall rules
- Already authenticated → Clear state and restart

### Serve/Funnel Not Working

**Check configuration:**
```bash
docker exec v2bucket-tailscale tailscale serve status
docker exec v2bucket-tailscale tailscale funnel status
```

**Reset and reconfigure:**
```bash
docker exec v2bucket-tailscale tailscale serve reset
docker-compose restart tailscale
```

### API/Web Not Accessible

**Verify services are healthy:**
```bash
docker-compose ps
```

Both API and Web must show "healthy" status.

**Check if ports are reachable:**
```bash
# From Tailscale container
docker exec v2bucket-tailscale wget -qO- http://127.0.0.1:3000/health
docker exec v2bucket-tailscale wget -qO- http://127.0.0.1:3001 | head -n 5
```

### Configuration Not Applied

**Tailscale might start before services:**

The `depends_on` with `condition: service_healthy` ensures services are ready, but there's an additional 10-second wait for safety.

**Increase wait time if needed:**

Edit docker-compose.yml and increase:
```bash
sleep 10  # Change to sleep 20 or higher
```

## 🔐 Security Notes

### Auth Key Rotation

The auth key in docker-compose.yml should be:
- **Reusable**: So container restarts work
- **Pre-approved**: To avoid manual approval
- **Not ephemeral**: So device stays registered
- **Rotated regularly**: Generate new key every 90 days

### Funnel Access

Funnel makes your service **publicly accessible** at:
- `https://v2bucket.discus-likert.ts.net`

Anyone on the internet can access it. Ensure:
- Strong authentication is enabled
- Rate limiting is configured
- Regular security updates

### Disable Public Access

To make it private (Tailscale network only):

```bash
docker exec v2bucket-tailscale tailscale funnel off
```

Or remove from docker-compose.yml:
```bash
# Comment out or remove this line:
# tailscale funnel --bg on
```

## 📝 Example Output

When containers start successfully, you'll see:

```
Starting Tailscale daemon...
Waiting for Tailscale to start...
Bringing up Tailscale...
Waiting for API and Web to be ready...
Configuring Tailscale Serve...
Setting up Web UI at root path...
Setting up API proxy at /api...
Setting up health check endpoint...
Setting up metrics endpoint...
Enabling Tailscale Funnel for public access...
Tailscale configuration complete!
Current serve status:

https://v2bucket.discus-likert.ts.net (Funnel on)
|-- / proxy http://127.0.0.1:3001
|-- /api proxy http://127.0.0.1:3000
|-- /health proxy http://127.0.0.1:3000
|-- /metrics proxy http://127.0.0.1:3000

Waiting for tailscaled to exit...
```

## ✅ Benefits of Auto-Configuration

1. **Zero Manual Steps**: No commands to run after deployment
2. **Consistent**: Same configuration every time
3. **Recoverable**: Restarts restore configuration automatically
4. **Documented**: Configuration is in docker-compose.yml
5. **Debuggable**: All steps logged in container logs
6. **Safe**: Waits for services to be healthy first

## 🎯 Quick Reference

| Task | Command |
|------|---------|
| View logs | `docker logs v2bucket-tailscale` |
| Check status | `docker exec v2bucket-tailscale tailscale serve status` |
| Check funnel | `docker exec v2bucket-tailscale tailscale funnel status` |
| Reset config | `docker exec v2bucket-tailscale tailscale serve reset` |
| Reconfigure | `docker-compose restart tailscale` |
| Disable funnel | `docker exec v2bucket-tailscale tailscale funnel off` |
| View Tailscale IP | `docker exec v2bucket-tailscale tailscale ip -4` |

---

**Your Tailscale configuration is now fully automated!** Just run `docker-compose up -d` and everything will be configured automatically. 🚀
