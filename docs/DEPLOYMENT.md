# V2-Bucket Deployment Guide

This guide covers various deployment options for V2-Bucket, from simple Docker setups to production Kubernetes clusters.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Docker Deployment](#docker-deployment)
- [Docker Compose Deployment](#docker-compose-deployment)
- [Synology NAS Deployment](#synology-nas-deployment)
- [QNAP NAS Deployment](#qnap-nas-deployment)
- [Kubernetes Deployment](#kubernetes-deployment)
- [Cloud Deployment](#cloud-deployment)
- [Reverse Proxy Setup](#reverse-proxy-setup)
- [SSL/TLS Configuration](#ssltls-configuration)
- [Monitoring Setup](#monitoring-setup)
- [Backup Strategy](#backup-strategy)

---

## Prerequisites

### Required Software

- **Docker**: v20.10 or higher
- **Docker Compose**: v2.0 or higher (for Docker Compose deployments)
- **PostgreSQL**: v14 or higher
- **MinIO**: Latest version
- **Node.js**: v20+ (for building from source)

### Hardware Requirements

**Minimum:**
- CPU: 2 cores
- RAM: 4 GB
- Storage: 20 GB + object storage space

**Recommended:**
- CPU: 4+ cores
- RAM: 8+ GB
- Storage: 50 GB + object storage space
- SSD for database and application

---

## Docker Deployment

### 1. Build Docker Images

**API Server:**
```bash
cd apps/api
docker build -t v2bucket/api:latest .
```

**Web Dashboard:**
```bash
cd apps/web
docker build -t v2bucket/web:latest .
```

### 2. Create Docker Network

```bash
docker network create v2bucket-network
```

### 3. Run PostgreSQL

```bash
docker run -d \
  --name v2bucket-postgres \
  --network v2bucket-network \
  -e POSTGRES_USER=v2bucket \
  -e POSTGRES_PASSWORD=secure-password \
  -e POSTGRES_DB=v2bucket \
  -v postgres-data:/var/lib/postgresql/data \
  -p 5432:5432 \
  postgres:14
```

### 4. Run MinIO

```bash
docker run -d \
  --name v2bucket-minio \
  --network v2bucket-network \
  -e MINIO_ROOT_USER=minioadmin \
  -e MINIO_ROOT_PASSWORD=secure-password \
  -v minio-data:/data \
  -p 9000:9000 \
  -p 9001:9001 \
  minio/minio server /data --console-address ":9001"
```

### 5. Run API Server

```bash
docker run -d \
  --name v2bucket-api \
  --network v2bucket-network \
  -e DATABASE_URL="postgresql://v2bucket:secure-password@v2bucket-postgres:5432/v2bucket" \
  -e MINIO_ENDPOINT="v2bucket-minio" \
  -e MINIO_PORT=9000 \
  -e MINIO_USE_SSL=false \
  -e MINIO_ROOT_USER="minioadmin" \
  -e MINIO_ROOT_PASSWORD="secure-password" \
  -e JWT_SECRET="your-super-secret-jwt-key" \
  -e NODE_ENV=production \
  -e PORT=3000 \
  -p 3000:3000 \
  v2bucket/api:latest
```

### 6. Run Database Migrations

```bash
docker exec -it v2bucket-api pnpm prisma migrate deploy
```

### 7. Run Web Dashboard

```bash
docker run -d \
  --name v2bucket-web \
  --network v2bucket-network \
  -e NEXT_PUBLIC_API_URL="http://your-domain.com:3000" \
  -p 3001:3000 \
  v2bucket/web:latest
```

---

## Docker Compose Deployment

### 1. Create Production Compose File

Create `docker-compose.prod.yml`:

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:14
    container_name: v2bucket-postgres
    environment:
      POSTGRES_USER: v2bucket
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: v2bucket
    volumes:
      - postgres-data:/var/lib/postgresql/data
    networks:
      - v2bucket-network
    restart: unless-stopped
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U v2bucket"]
      interval: 10s
      timeout: 5s
      retries: 5

  minio:
    image: minio/minio:latest
    container_name: v2bucket-minio
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: ${MINIO_ROOT_USER}
      MINIO_ROOT_PASSWORD: ${MINIO_ROOT_PASSWORD}
    volumes:
      - minio-data:/data
    ports:
      - "9000:9000"
      - "9001:9001"
    networks:
      - v2bucket-network
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:9000/minio/health/live"]
      interval: 30s
      timeout: 20s
      retries: 3

  api:
    image: v2bucket/api:latest
    container_name: v2bucket-api
    depends_on:
      postgres:
        condition: service_healthy
      minio:
        condition: service_healthy
    environment:
      NODE_ENV: production
      PORT: 3000
      DATABASE_URL: postgresql://v2bucket:${POSTGRES_PASSWORD}@postgres:5432/v2bucket
      MINIO_ENDPOINT: minio
      MINIO_PORT: 9000
      MINIO_USE_SSL: false
      MINIO_ROOT_USER: ${MINIO_ROOT_USER}
      MINIO_ROOT_PASSWORD: ${MINIO_ROOT_PASSWORD}
      JWT_SECRET: ${JWT_SECRET}
      CORS_ORIGIN: ${CORS_ORIGIN}
      RATE_LIMIT_MAX: 1000
      RATE_LIMIT_TIME_WINDOW: 1m
    ports:
      - "3000:3000"
    networks:
      - v2bucket-network
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  web:
    image: v2bucket/web:latest
    container_name: v2bucket-web
    depends_on:
      - api
    environment:
      NODE_ENV: production
      NEXT_PUBLIC_API_URL: ${API_URL}
    ports:
      - "3001:3000"
    networks:
      - v2bucket-network
    restart: unless-stopped

volumes:
  postgres-data:
  minio-data:

networks:
  v2bucket-network:
    driver: bridge
```

### 2. Create Environment File

Create `.env.prod`:

```env
# PostgreSQL
POSTGRES_PASSWORD=your-strong-password

# MinIO
MINIO_ROOT_USER=your-minio-user
MINIO_ROOT_PASSWORD=your-strong-minio-password

# API
JWT_SECRET=your-super-secret-jwt-key-min-32-chars
CORS_ORIGIN=https://your-domain.com

# Web
API_URL=https://api.your-domain.com
```

### 3. Deploy

```bash
docker-compose -f docker-compose.prod.yml --env-file .env.prod up -d
```

### 4. Run Migrations

```bash
docker-compose -f docker-compose.prod.yml exec api pnpm prisma migrate deploy
```

### 5. Verify Deployment

```bash
# Check services
docker-compose -f docker-compose.prod.yml ps

# Check logs
docker-compose -f docker-compose.prod.yml logs -f

# Test health endpoint
curl http://localhost:3000/health
```

---

## Synology NAS Deployment

### Option 1: Using Container Manager (Docker UI)

1. **Open Container Manager** (formerly Docker package)

2. **Create Network**
   - Go to Network tab
   - Click Add
   - Name: `v2bucket-network`
   - Click Apply

3. **Deploy PostgreSQL**
   - Go to Container tab
   - Click Add > Create Container
   - Image: `postgres:14`
   - Container Name: `v2bucket-postgres`
   - Network: `v2bucket-network`
   - Environment Variables:
     ```
     POSTGRES_USER=v2bucket
     POSTGRES_PASSWORD=secure-password
     POSTGRES_DB=v2bucket
     ```
   - Volume: `/volume1/docker/v2bucket/postgres` → `/var/lib/postgresql/data`
   - Port: `5432` → `5432`
   - Click Apply

4. **Deploy MinIO**
   - Create Container
   - Image: `minio/minio:latest`
   - Container Name: `v2bucket-minio`
   - Network: `v2bucket-network`
   - Command: `server /data --console-address ":9001"`
   - Environment Variables:
     ```
     MINIO_ROOT_USER=minioadmin
     MINIO_ROOT_PASSWORD=secure-password
     ```
   - Volume: `/volume1/docker/v2bucket/minio` → `/data`
   - Ports: `9000` → `9000`, `9001` → `9001`
   - Click Apply

5. **Deploy API Server**
   - Build or pull image first: `v2bucket/api:latest`
   - Create Container
   - Container Name: `v2bucket-api`
   - Network: `v2bucket-network`
   - Environment Variables:
     ```
     DATABASE_URL=postgresql://v2bucket:secure-password@v2bucket-postgres:5432/v2bucket
     MINIO_ENDPOINT=v2bucket-minio
     MINIO_PORT=9000
     MINIO_USE_SSL=false
     MINIO_ROOT_USER=minioadmin
     MINIO_ROOT_PASSWORD=secure-password
     JWT_SECRET=your-secret-key
     NODE_ENV=production
     PORT=3000
     ```
   - Port: `3000` → `3000`
   - Click Apply

6. **Deploy Web Dashboard**
   - Create Container
   - Image: `v2bucket/web:latest`
   - Container Name: `v2bucket-web`
   - Network: `v2bucket-network`
   - Environment Variables:
     ```
     NEXT_PUBLIC_API_URL=http://your-nas-ip:3000
     ```
   - Port: `3001` → `3000`
   - Click Apply

### Option 2: Using SSH and Docker Compose

1. **Enable SSH** on your Synology NAS

2. **SSH into your NAS**
   ```bash
   ssh admin@your-nas-ip
   ```

3. **Install Docker Compose** (if not installed)
   ```bash
   sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
   sudo chmod +x /usr/local/bin/docker-compose
   ```

4. **Create Project Directory**
   ```bash
   sudo mkdir -p /volume1/docker/v2bucket
   cd /volume1/docker/v2bucket
   ```

5. **Upload docker-compose.prod.yml and .env.prod**

6. **Deploy**
   ```bash
   sudo docker-compose -f docker-compose.prod.yml --env-file .env.prod up -d
   ```

---

## QNAP NAS Deployment

### Using Container Station

1. **Open Container Station**

2. **Create Application**
   - Click Create Application
   - Choose "Create Application using Docker Compose"
   - Name: `v2bucket`
   - Paste the `docker-compose.prod.yml` content
   - Click Validate and Create

3. **Configure Volumes**
   - Map volumes to QNAP shared folders:
     - postgres-data → `/share/Container/v2bucket/postgres`
     - minio-data → `/share/Container/v2bucket/minio`

4. **Start Application**
   - Click Start on the v2bucket application

5. **Access**
   - Web Dashboard: `http://qnap-ip:3001`
   - API: `http://qnap-ip:3000`
   - MinIO Console: `http://qnap-ip:9001`

---

## Kubernetes Deployment

### 1. Create Namespace

```yaml
# k8s/namespace.yaml
apiVersion: v1
kind: Namespace
metadata:
  name: v2bucket
```

```bash
kubectl apply -f k8s/namespace.yaml
```

### 2. Create Secrets

```yaml
# k8s/secrets.yaml
apiVersion: v1
kind: Secret
metadata:
  name: v2bucket-secrets
  namespace: v2bucket
type: Opaque
stringData:
  postgres-password: your-strong-password
  minio-root-user: minioadmin
  minio-root-password: your-strong-minio-password
  jwt-secret: your-super-secret-jwt-key
```

```bash
kubectl apply -f k8s/secrets.yaml
```

### 3. Deploy PostgreSQL

```yaml
# k8s/postgres.yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: postgres-pvc
  namespace: v2bucket
spec:
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 10Gi
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: postgres
  namespace: v2bucket
spec:
  replicas: 1
  selector:
    matchLabels:
      app: postgres
  template:
    metadata:
      labels:
        app: postgres
    spec:
      containers:
      - name: postgres
        image: postgres:14
        env:
        - name: POSTGRES_USER
          value: v2bucket
        - name: POSTGRES_PASSWORD
          valueFrom:
            secretKeyRef:
              name: v2bucket-secrets
              key: postgres-password
        - name: POSTGRES_DB
          value: v2bucket
        ports:
        - containerPort: 5432
        volumeMounts:
        - name: postgres-storage
          mountPath: /var/lib/postgresql/data
      volumes:
      - name: postgres-storage
        persistentVolumeClaim:
          claimName: postgres-pvc
---
apiVersion: v1
kind: Service
metadata:
  name: postgres
  namespace: v2bucket
spec:
  selector:
    app: postgres
  ports:
  - port: 5432
    targetPort: 5432
```

```bash
kubectl apply -f k8s/postgres.yaml
```

### 4. Deploy MinIO

```yaml
# k8s/minio.yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: minio-pvc
  namespace: v2bucket
spec:
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 50Gi
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: minio
  namespace: v2bucket
spec:
  replicas: 1
  selector:
    matchLabels:
      app: minio
  template:
    metadata:
      labels:
        app: minio
    spec:
      containers:
      - name: minio
        image: minio/minio:latest
        command: ["minio", "server", "/data", "--console-address", ":9001"]
        env:
        - name: MINIO_ROOT_USER
          valueFrom:
            secretKeyRef:
              name: v2bucket-secrets
              key: minio-root-user
        - name: MINIO_ROOT_PASSWORD
          valueFrom:
            secretKeyRef:
              name: v2bucket-secrets
              key: minio-root-password
        ports:
        - containerPort: 9000
        - containerPort: 9001
        volumeMounts:
        - name: minio-storage
          mountPath: /data
      volumes:
      - name: minio-storage
        persistentVolumeClaim:
          claimName: minio-pvc
---
apiVersion: v1
kind: Service
metadata:
  name: minio
  namespace: v2bucket
spec:
  selector:
    app: minio
  ports:
  - name: api
    port: 9000
    targetPort: 9000
  - name: console
    port: 9001
    targetPort: 9001
```

```bash
kubectl apply -f k8s/minio.yaml
```

### 5. Deploy API Server

```yaml
# k8s/api.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: api
  namespace: v2bucket
spec:
  replicas: 2
  selector:
    matchLabels:
      app: api
  template:
    metadata:
      labels:
        app: api
    spec:
      containers:
      - name: api
        image: v2bucket/api:latest
        env:
        - name: NODE_ENV
          value: production
        - name: PORT
          value: "3000"
        - name: DATABASE_URL
          value: postgresql://v2bucket:$(POSTGRES_PASSWORD)@postgres:5432/v2bucket
        - name: POSTGRES_PASSWORD
          valueFrom:
            secretKeyRef:
              name: v2bucket-secrets
              key: postgres-password
        - name: MINIO_ENDPOINT
          value: minio
        - name: MINIO_PORT
          value: "9000"
        - name: MINIO_USE_SSL
          value: "false"
        - name: MINIO_ROOT_USER
          valueFrom:
            secretKeyRef:
              name: v2bucket-secrets
              key: minio-root-user
        - name: MINIO_ROOT_PASSWORD
          valueFrom:
            secretKeyRef:
              name: v2bucket-secrets
              key: minio-root-password
        - name: JWT_SECRET
          valueFrom:
            secretKeyRef:
              name: v2bucket-secrets
              key: jwt-secret
        ports:
        - containerPort: 3000
        livenessProbe:
          httpGet:
            path: /health/live
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health/ready
            port: 3000
          initialDelaySeconds: 10
          periodSeconds: 5
---
apiVersion: v1
kind: Service
metadata:
  name: api
  namespace: v2bucket
spec:
  selector:
    app: api
  ports:
  - port: 3000
    targetPort: 3000
```

```bash
kubectl apply -f k8s/api.yaml
```

### 6. Deploy Web Dashboard

```yaml
# k8s/web.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: web
  namespace: v2bucket
spec:
  replicas: 2
  selector:
    matchLabels:
      app: web
  template:
    metadata:
      labels:
        app: web
    spec:
      containers:
      - name: web
        image: v2bucket/web:latest
        env:
        - name: NODE_ENV
          value: production
        - name: NEXT_PUBLIC_API_URL
          value: https://api.your-domain.com
        ports:
        - containerPort: 3000
---
apiVersion: v1
kind: Service
metadata:
  name: web
  namespace: v2bucket
spec:
  selector:
    app: web
  ports:
  - port: 80
    targetPort: 3000
```

```bash
kubectl apply -f k8s/web.yaml
```

### 7. Create Ingress

```yaml
# k8s/ingress.yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: v2bucket-ingress
  namespace: v2bucket
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
spec:
  ingressClassName: nginx
  tls:
  - hosts:
    - v2bucket.your-domain.com
    - api.your-domain.com
    secretName: v2bucket-tls
  rules:
  - host: v2bucket.your-domain.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: web
            port:
              number: 80
  - host: api.your-domain.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: api
            port:
              number: 3000
```

```bash
kubectl apply -f k8s/ingress.yaml
```

---

## Cloud Deployment

### AWS (ECS + RDS + S3)

V2-Bucket can leverage AWS native services:

1. **RDS PostgreSQL** for database
2. **S3** for object storage (instead of MinIO)
3. **ECS Fargate** for containers
4. **ALB** for load balancing
5. **CloudWatch** for monitoring

### Google Cloud (GKE + Cloud SQL + GCS)

1. **Cloud SQL for PostgreSQL**
2. **Cloud Storage** (GCS-compatible with S3 API)
3. **GKE** for Kubernetes
4. **Cloud Load Balancer**
5. **Cloud Monitoring**

### Azure (AKS + Azure Database + Blob Storage)

1. **Azure Database for PostgreSQL**
2. **Azure Blob Storage** (S3-compatible)
3. **AKS** for Kubernetes
4. **Application Gateway**
5. **Azure Monitor**

---

## Reverse Proxy Setup

### Nginx Configuration

```nginx
# /etc/nginx/sites-available/v2bucket
upstream api_backend {
    server localhost:3000;
}

upstream web_backend {
    server localhost:3001;
}

# API Server
server {
    listen 80;
    server_name api.your-domain.com;

    client_max_body_size 100M;

    location / {
        proxy_pass http://api_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;

        # Timeouts for large file uploads
        proxy_connect_timeout 600;
        proxy_send_timeout 600;
        proxy_read_timeout 600;
        send_timeout 600;
    }
}

# Web Dashboard
server {
    listen 80;
    server_name v2bucket.your-domain.com;

    location / {
        proxy_pass http://web_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Enable site:
```bash
sudo ln -s /etc/nginx/sites-available/v2bucket /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

---

## SSL/TLS Configuration

### Using Let's Encrypt with Certbot

```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx

# Obtain certificates
sudo certbot --nginx -d api.your-domain.com -d v2bucket.your-domain.com

# Auto-renewal (already configured)
sudo certbot renew --dry-run
```

Updated Nginx config will include:

```nginx
server {
    listen 443 ssl http2;
    server_name api.your-domain.com;

    ssl_certificate /etc/letsencrypt/live/api.your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.your-domain.com/privkey.pem;

    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # ... rest of config
}
```

---

## Monitoring Setup

### Prometheus + Grafana

1. **Deploy Prometheus**

```yaml
# k8s/prometheus.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: prometheus-config
  namespace: v2bucket
data:
  prometheus.yml: |
    global:
      scrape_interval: 15s
    scrape_configs:
      - job_name: 'v2bucket-api'
        static_configs:
          - targets: ['api:3000']
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: prometheus
  namespace: v2bucket
spec:
  replicas: 1
  selector:
    matchLabels:
      app: prometheus
  template:
    metadata:
      labels:
        app: prometheus
    spec:
      containers:
      - name: prometheus
        image: prom/prometheus:latest
        ports:
        - containerPort: 9090
        volumeMounts:
        - name: config
          mountPath: /etc/prometheus
      volumes:
      - name: config
        configMap:
          name: prometheus-config
---
apiVersion: v1
kind: Service
metadata:
  name: prometheus
  namespace: v2bucket
spec:
  selector:
    app: prometheus
  ports:
  - port: 9090
    targetPort: 9090
```

2. **Deploy Grafana**

```yaml
# k8s/grafana.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: grafana
  namespace: v2bucket
spec:
  replicas: 1
  selector:
    matchLabels:
      app: grafana
  template:
    metadata:
      labels:
        app: grafana
    spec:
      containers:
      - name: grafana
        image: grafana/grafana:latest
        ports:
        - containerPort: 3000
        env:
        - name: GF_SECURITY_ADMIN_PASSWORD
          value: admin
---
apiVersion: v1
kind: Service
metadata:
  name: grafana
  namespace: v2bucket
spec:
  selector:
    app: grafana
  ports:
  - port: 3000
    targetPort: 3000
```

3. **Import Dashboard**
   - Access Grafana: `http://your-domain:3000`
   - Add Prometheus data source: `http://prometheus:9090`
   - Import pre-built dashboard (ID: 1860 for Node Exporter)

---

## Backup Strategy

### Database Backups

**Automated PostgreSQL Backup:**

```bash
#!/bin/bash
# backup-postgres.sh

BACKUP_DIR="/backups/postgres"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/v2bucket_$TIMESTAMP.sql"

# Create backup
docker exec v2bucket-postgres pg_dump -U v2bucket v2bucket > "$BACKUP_FILE"

# Compress
gzip "$BACKUP_FILE"

# Delete backups older than 30 days
find "$BACKUP_DIR" -name "*.sql.gz" -mtime +30 -delete

echo "Backup completed: ${BACKUP_FILE}.gz"
```

**Setup Cron Job:**
```bash
# Run daily at 2 AM
0 2 * * * /path/to/backup-postgres.sh
```

### MinIO Data Backups

**Using MinIO Client (mc):**

```bash
# Install mc
wget https://dl.min.io/client/mc/release/linux-amd64/mc
chmod +x mc
sudo mv mc /usr/local/bin/

# Configure
mc alias set v2bucket http://localhost:9000 minioadmin secure-password

# Backup bucket
mc mirror v2bucket/my-bucket /backups/minio/my-bucket

# Scheduled backup script
#!/bin/bash
# backup-minio.sh
BACKUP_DIR="/backups/minio"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

mc mirror v2bucket/ "$BACKUP_DIR/$TIMESTAMP/"

# Delete backups older than 30 days
find "$BACKUP_DIR" -maxdepth 1 -type d -mtime +30 -exec rm -rf {} \;
```

---

## Post-Deployment Checklist

- [ ] All services are running and healthy
- [ ] Database migrations completed successfully
- [ ] SSL/TLS certificates installed and valid
- [ ] Firewall rules configured properly
- [ ] Environment variables secured (not exposed)
- [ ] Backup strategy implemented
- [ ] Monitoring and alerting configured
- [ ] Admin user created and tested
- [ ] S3 API tested with AWS CLI
- [ ] Web dashboard accessible and functional
- [ ] Rate limiting configured appropriately
- [ ] CORS settings configured for your domain
- [ ] Log rotation configured
- [ ] Documentation updated with deployment details

---

## Troubleshooting

### Services Won't Start

```bash
# Check logs
docker-compose logs -f service-name

# Check service health
docker ps
docker inspect container-name
```

### Database Connection Issues

```bash
# Test PostgreSQL connection
docker exec -it v2bucket-postgres psql -U v2bucket -d v2bucket

# Check connection from API
docker exec -it v2bucket-api sh
nc -zv postgres 5432
```

### MinIO Connection Issues

```bash
# Check MinIO health
curl http://localhost:9000/minio/health/live

# Access MinIO console
# http://localhost:9001
```

### Performance Issues

- Check resource usage: `docker stats`
- Review PostgreSQL query performance
- Check MinIO storage performance
- Adjust rate limits if needed
- Scale horizontally (add more replicas)

---

## Support

For deployment assistance:
- Check GitHub Issues
- Review documentation
- Contact support team
