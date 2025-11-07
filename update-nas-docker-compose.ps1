# PowerShell script to update docker-compose.yml on NAS
# Run this from your development machine

$NAS_IP = Read-Host "Enter your NAS IP address (e.g., 192.168.1.100)"
$NAS_USER = Read-Host "Enter your NAS username (e.g., vatsal-nas)"

$LOCAL_FILE = "docker-compose.yml"
$REMOTE_PATH = "/volume1/docker/v2-bucket/docker-compose.yml"

Write-Host "`nUploading docker-compose.yml to NAS..." -ForegroundColor Yellow

# Use SCP to copy the file
scp $LOCAL_FILE "${NAS_USER}@${NAS_IP}:${REMOTE_PATH}"

if ($LASTEXITCODE -eq 0) {
    Write-Host "`n✓ File uploaded successfully!" -ForegroundColor Green

    Write-Host "`nRestarting Docker containers..." -ForegroundColor Yellow

    # SSH to NAS and restart containers
    ssh "${NAS_USER}@${NAS_IP}" "cd /volume1/docker/v2-bucket && sudo docker compose down && sudo docker compose up -d"

    Write-Host "`n✓ Containers restarted!" -ForegroundColor Green
    Write-Host "`nMonitor the logs with:" -ForegroundColor Cyan
    Write-Host "ssh ${NAS_USER}@${NAS_IP} 'sudo docker logs -f v2bucket-api'" -ForegroundColor White
} else {
    Write-Host "`n✗ Upload failed. Please check your connection and try again." -ForegroundColor Red
}
