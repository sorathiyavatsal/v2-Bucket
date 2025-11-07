# V2-Bucket Development Guide

Complete guide for setting up and developing V2-Bucket locally.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Initial Setup](#initial-setup)
- [Project Structure](#project-structure)
- [Development Workflow](#development-workflow)
- [Database Management](#database-management)
- [Testing](#testing)
- [Debugging](#debugging)
- [Code Style & Linting](#code-style--linting)
- [Git Workflow](#git-workflow)
- [Common Tasks](#common-tasks)
- [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Required Software

1. **Node.js v20+**
   ```bash
   # Check version
   node --version  # Should be v20.0.0 or higher

   # Install via nvm (recommended)
   curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
   nvm install 20
   nvm use 20
   ```

2. **pnpm v9+**
   ```bash
   # Install pnpm
   npm install -g pnpm@9

   # Check version
   pnpm --version  # Should be 9.0.0 or higher
   ```

3. **Docker & Docker Compose**
   ```bash
   # Install Docker Desktop (Mac/Windows)
   # Or Docker Engine (Linux)

   # Check versions
   docker --version
   docker-compose --version
   ```

4. **Git**
   ```bash
   git --version
   ```

5. **VS Code** (Recommended)
   - Extensions:
     - ESLint
     - Prettier
     - Prisma
     - TypeScript and JavaScript Language Features
     - Tailwind CSS IntelliSense

---

## Initial Setup

### 1. Clone Repository

```bash
git clone <repository-url>
cd v2-bucket
```

### 2. Install Dependencies

```bash
# Install all dependencies (root + all workspaces)
pnpm install
```

This will install dependencies for:
- Root workspace
- `apps/api`
- `apps/web`
- All packages in `packages/`

### 3. Start Development Services

Start PostgreSQL and MinIO using Docker Compose:

```bash
docker-compose up -d
```

This starts:
- **PostgreSQL** on port `5432`
- **MinIO** on ports `9000` (API) and `9001` (Console)

Verify services are running:
```bash
docker-compose ps
```

### 4. Configure Environment Variables

**API Server** (`apps/api/.env`):
```env
# Database
DATABASE_URL="postgresql://postgres:password@localhost:5432/v2bucket"

# MinIO
MINIO_ENDPOINT="localhost"
MINIO_PORT=9000
MINIO_USE_SSL=false
MINIO_ROOT_USER="minioadmin"
MINIO_ROOT_PASSWORD="minioadmin"

# Server
PORT=3000
NODE_ENV=development

# JWT
JWT_SECRET="dev-secret-key-change-in-production"
JWT_EXPIRES_IN="7d"

# CORS
CORS_ORIGIN="http://localhost:3001"

# Rate Limiting
RATE_LIMIT_MAX=100
RATE_LIMIT_TIME_WINDOW="1m"

# Logging
LOG_LEVEL="debug"
```

**Web Dashboard** (`apps/web/.env.local`):
```env
NEXT_PUBLIC_API_URL=http://localhost:3000
NODE_ENV=development
```

### 5. Set Up Database

```bash
cd apps/api

# Run migrations
pnpm prisma migrate dev

# (Optional) Seed database with sample data
pnpm prisma db seed

# (Optional) Open Prisma Studio to view data
pnpm prisma studio
```

### 6. Start Development Servers

**Option 1: Start all services (from root)**
```bash
pnpm dev
```

This starts:
- API server at `http://localhost:3000`
- Web dashboard at `http://localhost:3001`

**Option 2: Start services individually**
```bash
# Terminal 1: API Server
cd apps/api
pnpm dev

# Terminal 2: Web Dashboard
cd apps/web
pnpm dev
```

### 7. Verify Setup

**Test API:**
```bash
# Health check
curl http://localhost:3000/health

# tRPC test endpoint
curl "http://localhost:3000/trpc/test.hello?input=%7B%22name%22%3A%22Developer%22%7D"
```

**Test Web Dashboard:**
- Open `http://localhost:3001` in your browser
- You should see the login page
- Default credentials (if seeded):
  - Email: `admin@v2bucket.com`
  - Password: `admin123`

**Test MinIO:**
- Open MinIO Console: `http://localhost:9001`
- Login with `minioadmin` / `minioadmin`

---

## Project Structure

```
v2-bucket/
├── apps/
│   ├── api/                    # Backend API server
│   │   ├── src/
│   │   │   ├── index.ts        # Entry point
│   │   │   ├── server.ts       # Fastify server setup
│   │   │   ├── trpc/           # tRPC configuration
│   │   │   │   ├── router.ts   # Main tRPC router
│   │   │   │   ├── context.ts  # tRPC context
│   │   │   │   └── routers/    # Individual route handlers
│   │   │   ├── routes/         # S3 API routes
│   │   │   ├── middleware/     # Fastify middleware
│   │   │   ├── services/       # Business logic
│   │   │   ├── lib/            # Utilities
│   │   │   └── types/          # TypeScript types
│   │   ├── prisma/
│   │   │   ├── schema.prisma   # Database schema
│   │   │   ├── migrations/     # Database migrations
│   │   │   └── seed.ts         # Seed script
│   │   ├── .env                # Environment variables
│   │   ├── tsconfig.json       # TypeScript config
│   │   └── package.json
│   │
│   └── web/                    # Frontend dashboard
│       ├── src/
│       │   ├── app/            # Next.js App Router
│       │   │   ├── (auth)/     # Auth pages (login, signup)
│       │   │   ├── app/        # Protected dashboard pages
│       │   │   ├── layout.tsx  # Root layout
│       │   │   └── page.tsx    # Home page
│       │   ├── components/     # React components
│       │   │   ├── ui/         # Base UI components
│       │   │   ├── layout/     # Layout components
│       │   │   ├── buckets/    # Bucket components
│       │   │   └── users/      # User components
│       │   ├── lib/            # Utilities
│       │   │   ├── utils.ts    # Helper functions
│       │   │   └── trpc.ts     # tRPC client
│       │   └── styles/         # Global styles
│       ├── public/             # Static assets
│       ├── .env.local          # Environment variables
│       ├── tailwind.config.ts  # Tailwind CSS config
│       ├── tsconfig.json       # TypeScript config
│       └── package.json
│
├── packages/                   # Shared packages
│   ├── database/               # Prisma client package
│   ├── typescript-config/      # Shared TS configs
│   └── eslint-config/          # Shared ESLint configs
│
├── docs/                       # Documentation
│   ├── API.md                  # API documentation
│   ├── DEPLOYMENT.md           # Deployment guide
│   └── DEVELOPMENT.md          # This file
│
├── docker-compose.yml          # Dev services (Postgres, MinIO)
├── turbo.json                  # Turborepo config
├── pnpm-workspace.yaml         # pnpm workspace config
├── package.json                # Root package.json
└── README.md                   # Main README
```

---

## Development Workflow

### Hot Reload

Both API and Web have hot reload enabled:

- **API**: Uses `tsx --watch` for auto-restart on file changes
- **Web**: Uses Next.js Fast Refresh for instant updates

### Making Changes

1. **Make your changes** to the code
2. **See changes reflected automatically** in your browser/API
3. **Test your changes** locally
4. **Commit your changes** with a descriptive message

### Building

```bash
# Build all apps
pnpm build

# Build specific app
cd apps/api && pnpm build
cd apps/web && pnpm build
```

Build output:
- **API**: `apps/api/dist/`
- **Web**: `apps/web/.next/`

---

## Database Management

### Prisma Schema

The database schema is defined in `apps/api/prisma/schema.prisma`:

```prisma
model User {
  id        String   @id @default(uuid())
  email     String   @unique
  password  String
  name      String
  role      Role     @default(USER)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

enum Role {
  ADMIN
  USER
}
```

### Common Prisma Commands

```bash
cd apps/api

# Create new migration after schema changes
pnpm prisma migrate dev --name add_new_field

# Reset database (WARNING: deletes all data)
pnpm prisma migrate reset

# Generate Prisma Client (run after schema changes)
pnpm prisma generate

# Open Prisma Studio (database GUI)
pnpm prisma studio

# Format schema file
pnpm prisma format

# View migration status
pnpm prisma migrate status

# Apply migrations in production
pnpm prisma migrate deploy
```

### Database Seeding

Seed file: `apps/api/prisma/seed.ts`

```bash
# Run seed
pnpm prisma db seed
```

Default seed data:
- Admin user: `admin@v2bucket.com` / `admin123`
- Test user: `user@v2bucket.com` / `user123`
- Sample buckets and objects

### Accessing Database Directly

```bash
# Via Docker
docker exec -it v2bucket-postgres psql -U postgres -d v2bucket

# SQL commands
\dt           # List tables
\d users      # Describe users table
SELECT * FROM users;
```

---

## Testing

### Unit Tests

```bash
# Run all tests
pnpm test

# Run tests for specific app
cd apps/api && pnpm test
cd apps/web && pnpm test

# Run tests in watch mode
pnpm test:watch

# Run tests with coverage
pnpm test:coverage
```

### API Testing

**Using curl:**
```bash
# Health check
curl http://localhost:3000/health

# tRPC endpoint
curl "http://localhost:3000/trpc/test.hello?input=%7B%22name%22%3A%22Test%22%7D"

# S3 API with AWS CLI
aws s3 ls --endpoint-url http://localhost:3000 --profile v2bucket
```

**Using Postman/Insomnia:**
- Import API collection from `docs/api-collection.json`
- Set base URL to `http://localhost:3000`

### E2E Testing

```bash
# Run Playwright tests (if configured)
cd apps/web
pnpm test:e2e
```

---

## Debugging

### VS Code Debugging

**API Server** (`.vscode/launch.json`):
```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "Debug API",
      "runtimeExecutable": "pnpm",
      "runtimeArgs": ["dev"],
      "cwd": "${workspaceFolder}/apps/api",
      "console": "integratedTerminal",
      "internalConsoleOptions": "neverOpen"
    }
  ]
}
```

Set breakpoints in VS Code and press F5 to start debugging.

### Console Logging

**API (Fastify Logger):**
```typescript
// In any API file
fastify.log.info('User created', { userId: user.id });
fastify.log.error('Database error', { error: err });
fastify.log.debug('Request data', { body: request.body });
```

**Web (Console):**
```typescript
console.log('Component rendered', { props });
console.error('API error', error);
```

### Chrome DevTools

For debugging web application:
1. Open `http://localhost:3001` in Chrome
2. Press F12 to open DevTools
3. Go to Sources tab to set breakpoints
4. Use Console tab for logging

---

## Code Style & Linting

### ESLint

```bash
# Lint all packages
pnpm lint

# Lint specific app
cd apps/api && pnpm lint
cd apps/web && pnpm lint

# Auto-fix issues
pnpm lint:fix
```

### Prettier (Auto-formatting)

Prettier is integrated with ESLint. Format on save is recommended:

**VS Code settings** (`.vscode/settings.json`):
```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  }
}
```

### TypeScript Type Checking

```bash
# Check types (no emit)
pnpm tsc --noEmit

# Check specific app
cd apps/api && pnpm tsc --noEmit
cd apps/web && pnpm tsc --noEmit
```

---

## Git Workflow

### Branch Naming

- `main` - Production branch
- `develop` - Development branch
- `feature/<name>` - New features
- `fix/<name>` - Bug fixes
- `docs/<name>` - Documentation updates
- `refactor/<name>` - Code refactoring

### Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add bucket versioning support
fix: resolve CORS issue on S3 API
docs: update deployment guide
refactor: simplify authentication middleware
test: add unit tests for user service
chore: update dependencies
```

### Workflow

1. **Create branch from develop:**
   ```bash
   git checkout develop
   git pull origin develop
   git checkout -b feature/my-feature
   ```

2. **Make changes and commit:**
   ```bash
   git add .
   git commit -m "feat: add new feature"
   ```

3. **Push to remote:**
   ```bash
   git push origin feature/my-feature
   ```

4. **Create Pull Request** to `develop` branch

5. **After review and approval**, merge to `develop`

6. **Periodically merge** `develop` to `main` for releases

---

## Common Tasks

### Add New tRPC Endpoint

1. **Create router file** (`apps/api/src/trpc/routers/myRouter.ts`):
   ```typescript
   import { z } from 'zod';
   import { router, publicProcedure } from '../trpc';

   export const myRouter = router({
     getData: publicProcedure
       .input(z.object({ id: z.string() }))
       .query(async ({ input }) => {
         return { id: input.id, data: 'example' };
       }),
   });
   ```

2. **Add to main router** (`apps/api/src/trpc/router.ts`):
   ```typescript
   import { myRouter } from './routers/myRouter';

   export const appRouter = router({
     my: myRouter,
     // ... other routers
   });
   ```

3. **Use in frontend** (`apps/web/src/app/page.tsx`):
   ```typescript
   const { data } = trpc.my.getData.useQuery({ id: '123' });
   ```

### Add New UI Component

1. **Create component** (`apps/web/src/components/ui/MyComponent.tsx`):
   ```typescript
   import { cn } from '@/lib/utils';

   export interface MyComponentProps {
     className?: string;
     children: React.ReactNode;
   }

   export function MyComponent({ className, children }: MyComponentProps) {
     return (
       <div className={cn('my-component', className)}>
         {children}
       </div>
     );
   }
   ```

2. **Use in page:**
   ```typescript
   import { MyComponent } from '@/components/ui/MyComponent';

   export default function Page() {
     return <MyComponent>Hello</MyComponent>;
   }
   ```

### Add New Database Model

1. **Update schema** (`apps/api/prisma/schema.prisma`):
   ```prisma
   model MyModel {
     id        String   @id @default(uuid())
     name      String
     createdAt DateTime @default(now())
   }
   ```

2. **Create migration:**
   ```bash
   cd apps/api
   pnpm prisma migrate dev --name add_my_model
   ```

3. **Use in code:**
   ```typescript
   const myModel = await prisma.myModel.create({
     data: { name: 'example' }
   });
   ```

### Add New Page

1. **Create page file** (`apps/web/src/app/app/my-page/page.tsx`):
   ```typescript
   export default function MyPage() {
     return (
       <div>
         <h1>My Page</h1>
       </div>
     );
   }
   ```

2. **Access at** `http://localhost:3001/app/my-page`

3. **Add to navigation** (`apps/web/src/components/layout/Sidebar.tsx`):
   ```typescript
   const navigation = [
     // ... existing items
     { name: 'My Page', href: '/app/my-page', icon: MyIcon },
   ];
   ```

---

## Troubleshooting

### Port Already in Use

```bash
# Find process using port
lsof -ti:3000

# Kill process
lsof -ti:3000 | xargs kill -9
```

### Database Connection Issues

```bash
# Check if PostgreSQL is running
docker ps | grep postgres

# Restart PostgreSQL
docker-compose restart postgres

# Check logs
docker-compose logs postgres
```

### MinIO Connection Issues

```bash
# Check if MinIO is running
docker ps | grep minio

# Restart MinIO
docker-compose restart minio

# Access MinIO console
open http://localhost:9001
```

### TypeScript Errors

```bash
# Regenerate Prisma Client
cd apps/api
pnpm prisma generate

# Clear TypeScript cache
rm -rf node_modules/.cache

# Reinstall dependencies
pnpm install
```

### Build Errors

```bash
# Clean build artifacts
pnpm clean

# Clear all node_modules and reinstall
rm -rf node_modules apps/*/node_modules packages/*/node_modules
pnpm install

# Clear turbo cache
rm -rf .turbo
```

### Hot Reload Not Working

```bash
# Restart development server
# Ctrl+C to stop, then:
pnpm dev

# Check for file watcher limits (Linux)
echo fs.inotify.max_user_watches=524288 | sudo tee -a /etc/sysctl.conf
sudo sysctl -p
```

---

## IDE Setup

### VS Code Recommended Extensions

Create `.vscode/extensions.json`:
```json
{
  "recommendations": [
    "dbaeumer.vscode-eslint",
    "esbenp.prettier-vscode",
    "prisma.prisma",
    "bradlc.vscode-tailwindcss",
    "ms-vscode.vscode-typescript-next"
  ]
}
```

### VS Code Settings

Create `.vscode/settings.json`:
```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "typescript.tsdk": "node_modules/typescript/lib",
  "typescript.enablePromptUseWorkspaceTsdk": true,
  "[prisma]": {
    "editor.defaultFormatter": "Prisma.prisma"
  }
}
```

---

## Performance Tips

### Development

1. **Use pnpm** instead of npm/yarn (faster, saves disk space)
2. **Enable TypeScript incremental builds** (already configured)
3. **Use Turbo cache** for faster builds (already configured)
4. **Close unused apps** when developing specific service

### Database

1. **Use indexes** for frequently queried fields
2. **Enable connection pooling** (already configured in Prisma)
3. **Run migrations** during low-traffic periods

### Docker

1. **Allocate more resources** to Docker Desktop (Memory: 4GB+, CPUs: 2+)
2. **Use volumes** for persistent data (already configured)
3. **Clean up unused containers**: `docker system prune`

---

## Additional Resources

### Documentation
- [Fastify Docs](https://www.fastify.io/docs/latest/)
- [Next.js Docs](https://nextjs.org/docs)
- [tRPC Docs](https://trpc.io/docs)
- [Prisma Docs](https://www.prisma.io/docs)
- [Tailwind CSS Docs](https://tailwindcss.com/docs)

### Learning Resources
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [React Documentation](https://react.dev/)
- [Turborepo Handbook](https://turbo.build/repo/docs)

---

## Getting Help

1. Check existing documentation in `docs/`
2. Search GitHub Issues
3. Ask in team chat/Slack
4. Create new GitHub Issue with:
   - Clear description of problem
   - Steps to reproduce
   - Error messages
   - Environment details

---

## Contributing

See [CONTRIBUTING.md](../CONTRIBUTING.md) for:
- Code of Conduct
- Pull Request process
- Coding standards
- Review process

---

Happy coding!
