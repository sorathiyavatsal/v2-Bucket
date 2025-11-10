# V2-Bucket

Modern, Self-Hosted S3-Compatible Object Storage for NAS Devices

## Overview

V2-Bucket is a production-ready, S3-compatible object storage platform designed specifically for NAS devices like Synology, QNAP, and others. Built with modern technologies, it provides enterprise-grade features while remaining easy to deploy and manage.

## Features

### Storage Management
- **S3-Compatible API** - Full compatibility with AWS S3 SDK and CLI tools
- **Bucket Management** - Create, configure, and manage storage buckets
- **Object Operations** - Upload, download, list, and delete objects
- **Multipart Upload** - Support for large file uploads with resumable capabilities
- **Versioning** - Keep multiple versions of objects for data protection
- **Object Tagging** - Organize and categorize objects with tags
- **Storage Analytics** - Track usage, bandwidth, and performance metrics

### Security & Access Control
- **User Management** - Create and manage multiple users with role-based access
- **Access Keys** - Generate AWS-compatible access keys (Access Key ID + Secret)
- **Bucket Policies** - Fine-grained access control with JSON policies
- **ACL Support** - Object-level access control lists
- **Encryption** - Server-side encryption for data at rest
- **CORS Configuration** - Cross-origin resource sharing support

### Admin Dashboard
- **Modern UI** - Clean, responsive interface built with Next.js 15 and Tailwind CSS
- **Real-time Analytics** - Monitor storage usage, API requests, and bandwidth
- **User Management** - Manage users, roles, and permissions
- **Access Key Management** - Generate and revoke access credentials
- **Bucket Dashboard** - View and manage all buckets from a central location
- **Mobile Responsive** - Optimized for mobile and tablet devices with bottom navigation

### Performance & Reliability
- **Chunked Transfer** - Efficient handling of large files
- **Rate Limiting** - Protect against abuse with configurable limits
- **Health Checks** - Kubernetes-ready liveness and readiness probes
- **Metrics Endpoint** - Prometheus-compatible metrics for monitoring
- **Error Handling** - Comprehensive error handling with detailed logging

## Tech Stack

### Backend (API)
- **Runtime**: Node.js 20+
- **Framework**: Hono (ultra-fast web framework)
- **API Layer**: tRPC (end-to-end type-safe APIs)
- **Database**: PostgreSQL with Prisma ORM
- **Storage**: Native filesystem storage (S3-compatible API)
- **Authentication**: Better-Auth with session management
- **Caching**: Redis for session and data caching
- **Validation**: Zod schemas

### Frontend (Web)
- **Framework**: Next.js 15 (React 18)
- **Language**: TypeScript 5.7
- **Styling**: Tailwind CSS
- **UI Components**: Custom component library with Radix UI primitives
- **Charts**: Recharts for analytics visualization
- **State Management**: React hooks
- **Icons**: Lucide React

### Infrastructure
- **Monorepo**: Turborepo for efficient builds
- **Package Manager**: pnpm 9+
- **Containerization**: Docker & Docker Compose
- **Orchestration**: Kubernetes-ready with health checks
- **Reverse Proxy**: Nginx configuration included

## Project Structure

```
v2-bucket/
├── apps/
│   ├── api/              # Backend API server
│   │   ├── src/
│   │   │   ├── index.ts           # Fastify server entry point
│   │   │   ├── server.ts          # Server configuration
│   │   │   ├── trpc/              # tRPC router setup
│   │   │   ├── routes/            # S3 API routes
│   │   │   ├── middleware/        # Rate limiting, CORS, security
│   │   │   ├── services/          # Business logic services
│   │   │   ├── lib/               # Utilities and helpers
│   │   │   └── types/             # TypeScript types
│   │   ├── prisma/
│   │   │   └── schema.prisma      # Database schema
│   │   ├── Dockerfile
│   │   └── package.json
│   │
│   └── web/              # Frontend dashboard
│       ├── src/
│       │   ├── app/               # Next.js app router
│       │   │   ├── (auth)/        # Auth pages (login, signup, etc.)
│       │   │   └── app/           # Protected dashboard pages
│       │   ├── components/        # React components
│       │   │   ├── ui/            # Base UI components
│       │   │   ├── layout/        # Layout components
│       │   │   ├── buckets/       # Bucket management components
│       │   │   └── users/         # User management components
│       │   ├── lib/               # Utilities and helpers
│       │   └── styles/            # Global styles
│       ├── public/                # Static assets
│       ├── Dockerfile
│       └── package.json
│
├── packages/             # Shared packages
│   ├── database/         # Prisma client and migrations
│   ├── typescript-config/# Shared TypeScript configs
│   └── eslint-config/    # Shared ESLint configs
│
├── docker-compose.yml    # Development environment
├── turbo.json           # Turborepo configuration
├── package.json         # Root package.json
└── pnpm-workspace.yaml  # pnpm workspace config
```

## Quick Start

### Prerequisites

- **Node.js**: v20.0.0 or higher
- **pnpm**: v9.0.0 or higher
- **Docker**: Latest version (for PostgreSQL and Redis)
- **PostgreSQL**: v14+ (via Docker or local install)
- **Redis**: v7+ (via Docker or local install)

### Installation

1. **Clone the repository**
```bash
git clone <repository-url>
cd v2-bucket
```

2. **Install dependencies**
```bash
pnpm install
```

3. **Set up environment variables**

Create `.env` file in project root:
```env
# Database
DATABASE_URL="postgresql://postgres:postgres@localhost:5433/v2bucket"

# Redis
REDIS_URL="redis://localhost:6380"

# Storage
STORAGE_PATH="/var/lib/v2bucket/storage"

# API
PORT=3000
NODE_ENV=development
CORS_ORIGIN="http://localhost:3001"

# Authentication (Better-Auth)
BETTER_AUTH_SECRET="your-super-secret-key-change-in-production"
BETTER_AUTH_URL="http://localhost:3001"

# JWT (for S3 API compatibility)
JWT_SECRET="your-jwt-secret-key-change-in-production"

# Next.js (Web Dashboard)
NEXT_PUBLIC_API_URL="http://localhost:3000"
```

4. **Start development services**

Start PostgreSQL and Redis:
```bash
docker-compose up -d postgres redis
```

5. **Run database migrations**
```bash
cd packages/database
pnpm prisma generate
pnpm prisma migrate dev
```

6. **Start development servers**
```bash
# From root directory
pnpm dev

# Or start services individually:
# API: cd apps/api && pnpm dev
# Web: cd apps/web && pnpm dev
```

This will start:
- API server at `http://localhost:3000`
- Web dashboard at `http://localhost:3001`
- API Health Check at `http://localhost:3000/health`

### Accessing the Dashboard

1. Navigate to `http://localhost:3001`
2. Create your first account (automatically becomes admin)
3. Generate access keys for S3 API access

## Development

### Running Individual Apps

```bash
# API server only
cd apps/api
pnpm dev

# Web dashboard only
cd apps/web
pnpm dev
```

### Building for Production

```bash
# Build all apps
pnpm build

# Build specific app
cd apps/api && pnpm build
cd apps/web && pnpm build
```

### Type Checking

```bash
# Check all packages
pnpm tsc --noEmit

# Check specific app
cd apps/api && pnpm tsc --noEmit
cd apps/web && pnpm tsc --noEmit
```

### Linting

```bash
# Lint all packages
pnpm lint

# Lint specific app
cd apps/api && pnpm lint
cd apps/web && pnpm lint
```

### Database Management

```bash
cd packages/database

# Create new migration
pnpm prisma migrate dev --name migration-name

# Reset database
pnpm prisma migrate reset

# Open Prisma Studio (database GUI)
pnpm prisma studio

# Generate Prisma Client
pnpm prisma generate
```

## API Documentation

### S3-Compatible Endpoints

V2-Bucket implements the AWS S3 API specification. Use any S3-compatible client:

```bash
# Configure AWS CLI
aws configure --profile v2bucket
# Access Key ID: <your-access-key>
# Secret Access Key: <your-secret-key>
# Default region: us-east-1
# Default output format: json

# List buckets
aws s3 ls --profile v2bucket --endpoint-url http://localhost:3000

# Create bucket
aws s3 mb s3://my-bucket --profile v2bucket --endpoint-url http://localhost:3000

# Upload file
aws s3 cp file.txt s3://my-bucket/ --profile v2bucket --endpoint-url http://localhost:3000

# List objects
aws s3 ls s3://my-bucket/ --profile v2bucket --endpoint-url http://localhost:3000
```

### Health Checks

```bash
# Basic health check
curl http://localhost:3000/health

# Liveness probe (Kubernetes)
curl http://localhost:3000/health/live

# Readiness probe (Kubernetes)
curl http://localhost:3000/health/ready
```

### Metrics

Prometheus-compatible metrics endpoint:
```bash
curl http://localhost:3000/metrics
```

### tRPC API

The admin dashboard communicates with the API via tRPC. Example routers:

- `auth.*` - Authentication (login, register, session management)
- `buckets.*` - Bucket management (list, create, delete, update)
- `objects.*` - Object operations (list, upload, download, delete)
- `accessKeys.*` - Access key management (list, create, revoke)
- `analytics.*` - Storage analytics and metrics
- `webhooks.*` - Webhook configuration

## Deployment

### Docker Deployment

1. **Build Docker images**
```bash
# API
cd apps/api
docker build -t v2bucket-api .

# Web
cd apps/web
docker build -t v2bucket-web .
```

2. **Run with Docker Compose**
```bash
docker-compose -f docker-compose.prod.yml up -d
```

### Kubernetes Deployment

Example Kubernetes manifests are provided in the `k8s/` directory:

```bash
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/configmap.yaml
kubectl apply -f k8s/secrets.yaml
kubectl apply -f k8s/postgres.yaml
kubectl apply -f k8s/minio.yaml
kubectl apply -f k8s/api.yaml
kubectl apply -f k8s/web.yaml
kubectl apply -f k8s/ingress.yaml
```

### Environment Variables (Production)

```env
# Node Environment
NODE_ENV=production

# Database & Cache
DATABASE_URL=postgresql://user:password@postgres:5432/v2bucket
REDIS_URL=redis://redis:6379

# Storage
STORAGE_PATH=/var/lib/v2bucket/storage

# API
PORT=3000
CORS_ORIGIN=https://your-domain.com

# Authentication
BETTER_AUTH_SECRET=<strong-random-secret-32-chars>
BETTER_AUTH_URL=https://your-domain.com
JWT_SECRET=<strong-random-secret>

# Web Dashboard
NEXT_PUBLIC_API_URL=https://api.your-domain.com
```

## Monitoring

### Metrics

V2-Bucket exposes Prometheus-compatible metrics at `/metrics`:

- HTTP request duration
- HTTP request count by status code
- Active connections
- Memory usage
- CPU usage

### Logging

Logs are output in JSON format (production) or pretty format (development):

```json
{
  "level": "info",
  "time": 1234567890,
  "msg": "Request completed",
  "req": { "method": "GET", "url": "/health" },
  "res": { "statusCode": 200 }
}
```

## Security

### Best Practices

1. **Change default credentials** - Never use default passwords in production
2. **Use strong JWT secrets** - Generate random, long secrets for JWT signing
3. **Enable HTTPS** - Always use TLS/SSL in production
4. **Configure CORS properly** - Only allow trusted origins
5. **Regular updates** - Keep dependencies up to date
6. **Rate limiting** - Adjust rate limits based on your needs
7. **Database security** - Use strong passwords, restrict network access
8. **MinIO security** - Configure proper access policies

### Security Headers

V2-Bucket implements security headers:
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `X-XSS-Protection: 1; mode=block`
- `Strict-Transport-Security` (HTTPS only)

## Troubleshooting

### Common Issues

**Database connection failed**
- Check PostgreSQL is running: `docker ps | grep postgres`
- Verify DATABASE_URL is correct in `.env`
- Ensure database exists: `docker exec -it v2bucket-postgres psql -U postgres -c "\l"`
- Check port mapping: PostgreSQL runs on port 5433 externally, 5432 internally

**Redis connection failed**
- Check Redis is running: `docker ps | grep redis`
- Verify REDIS_URL is correct in `.env`
- Test connection: `docker exec v2bucket-redis redis-cli ping`

**Port already in use**
- Change PORT in `.env` file
- Kill process using the port: `lsof -ti:3000 | xargs kill`

**Build errors**
- Clear cache: `pnpm clean`
- Reinstall dependencies: `rm -rf node_modules && pnpm install`
- Check Node.js version: `node --version` (should be v20+)

## Contributing

Contributions are welcome! Please follow these guidelines:

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'Add amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## License

MIT License - see LICENSE file for details

## Support

For issues, questions, or feature requests, please open an issue on GitHub.

## Roadmap

### Completed
- [x] Core S3 API implementation
- [x] Bucket and object management
- [x] User and access key management
- [x] Admin dashboard UI
- [x] Analytics and metrics
- [x] Mobile-responsive design
- [x] Health checks and monitoring

### Planned
- [ ] Object lifecycle policies
- [ ] Automated backups
- [ ] Multi-tenant support
- [ ] CDN integration
- [ ] Advanced search and filtering
- [ ] Audit logging
- [ ] Two-factor authentication
- [ ] LDAP/AD integration

## Acknowledgments

Built with modern open-source technologies:
- [Hono](https://hono.dev/) - Ultra-fast web framework
- [Next.js](https://nextjs.org/) - React framework
- [tRPC](https://trpc.io/) - Type-safe APIs
- [Prisma](https://www.prisma.io/) - Next-generation ORM
- [Better-Auth](https://www.better-auth.com/) - Authentication framework
- [Tailwind CSS](https://tailwindcss.com/) - Utility-first CSS
- [Turborepo](https://turbo.build/) - High-performance build system
- [Radix UI](https://www.radix-ui.com/) - Accessible UI components
