# V2-Bucket Documentation

Complete documentation for the V2-Bucket S3-compatible object storage platform.

## 📚 Documentation Index

### Getting Started

- **[Quick Start Guide](../QUICK_START.md)** - Get V2-Bucket running in 3 simple steps
- **[Local Development Setup](../LOCAL-DEVELOPMENT.md)** - Set up your development environment
- **[README](../README.md)** - Project overview, features, and basic setup

### Deployment Guides

- **[Docker Deployment](DEPLOYMENT.md)** - Complete Docker deployment guide with Tailscale Funnel
- **[NAS Deployment](NAS_DEPLOYMENT.md)** - Deploy on Synology/QNAP NAS devices
- **[Deploy from Git](NAS_DEPLOY_FROM_GIT.md)** - Deploy directly from GitHub repository
- **[Tailscale Auto Setup](../TAILSCALE_AUTO_SETUP.md)** - Automatic Tailscale Serve and Funnel configuration

### Technical Documentation

- **[API Reference](API.md)** - Complete API documentation for S3 and tRPC endpoints
- **[Development Guide](DEVELOPMENT.md)** - Development workflow, conventions, and best practices
- **[Storage Configuration](STORAGE_CONFIGURATION.md)** - Configure storage location on NAS filesystem
- **[Native Storage Implementation](NATIVE_STORAGE_IMPLEMENTATION.md)** - Technical details of the native filesystem storage
- **[Project Summary](PROJECT_SUMMARY.md)** - Complete project summary with all implemented features

## 🏗️ Architecture

V2-Bucket is built as a modern monorepo with the following structure:

```
v2-bucket/
├── apps/
│   ├── api/              # Hono-based API server
│   └── web/              # Next.js 15 dashboard
├── packages/
│   └── database/         # Prisma schema and migrations
├── docs/                 # Documentation (you are here)
└── docker-compose.yml    # Development environment
```

### Tech Stack

**Backend:**
- Hono (web framework)
- tRPC (type-safe APIs)
- Prisma + PostgreSQL (database)
- Redis (caching)
- Better-Auth (authentication)

**Frontend:**
- Next.js 15 (React framework)
- Tailwind CSS (styling)
- Radix UI (components)
- Recharts (analytics)

## 📖 Quick Links

### For Users
- [Quick Start](../QUICK_START.md) - 3-step deployment
- [API Documentation](API.md) - How to use the S3 API
- [NAS Deployment](NAS_DEPLOYMENT.md) - Deploy on your NAS

### For Developers
- [Local Development](../LOCAL-DEVELOPMENT.md) - Set up development environment
- [Development Guide](DEVELOPMENT.md) - Coding conventions and workflow
- [API Reference](API.md) - tRPC router documentation

### For DevOps
- [Docker Deployment](DEPLOYMENT.md) - Production Docker setup
- [Deploy from Git](NAS_DEPLOY_FROM_GIT.md) - CI/CD deployment strategy

## 🔧 Common Tasks

### Development
```bash
# Start local development
pnpm dev

# Run database migrations
cd packages/database && pnpm prisma migrate dev

# Open Prisma Studio
cd packages/database && pnpm prisma studio
```

### Docker Deployment
```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

### Database Management
```bash
# Connect to PostgreSQL
docker exec -it v2bucket-postgres psql -U postgres -d v2bucket

# Connect to Redis
docker exec -it v2bucket-redis redis-cli
```

## 🆘 Troubleshooting

### Common Issues

**Database connection failed**
- Check PostgreSQL is running: `docker ps | grep postgres`
- Verify DATABASE_URL in `.env`
- Check port mapping (5433:5432)

**API not starting**
- Check logs: `docker-compose logs api`
- Verify all environment variables are set
- Ensure database migrations completed

**Web UI not loading**
- Check logs: `docker-compose logs web`
- Verify NEXT_PUBLIC_API_URL is correct
- Ensure API is running and healthy

**S3 API not working**
- Generate access keys in dashboard
- Configure AWS CLI with your keys
- Use `--endpoint-url` flag with AWS CLI

## 📝 Version History

- **v1.0.0** (Jan 2025) - Initial release
  - Full S3 API compatibility
  - Admin dashboard
  - Native filesystem storage
  - Better-Auth authentication
  - Docker deployment

## 🤝 Contributing

We welcome contributions! Please see:
1. [Development Guide](DEVELOPMENT.md) for coding standards
2. [API Documentation](API.md) for API details
3. GitHub Issues for bug reports and feature requests

## 📄 License

MIT License - see LICENSE file for details

---

**Need Help?**
- Check the [Quick Start Guide](../QUICK_START.md)
- Review [Troubleshooting](#-troubleshooting) section
- Open an issue on GitHub
