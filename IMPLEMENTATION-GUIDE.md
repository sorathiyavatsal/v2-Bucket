# V2-Bucket Implementation Phase Guide

Complete step-by-step guide for implementing all features of the V2-Bucket platform, organized by functionality and complexity.

---

## Table of Contents

1. [Project Setup](#1-project-setup)
2. [Authentication System](#2-authentication-system)
3. [Dashboard & Analytics](#3-dashboard--analytics)
4. [Bucket Management](#4-bucket-management)
5. [Object Operations](#5-object-operations)
6. [Access Keys Management](#6-access-keys-management)
7. [Presigned URLs](#7-presigned-urls)
8. [Multipart Upload](#8-multipart-upload)
9. [Bucket Policies & CORS](#9-bucket-policies--cors)
10. [User Management (Admin)](#10-user-management-admin)
11. [Testing & Quality Assurance](#11-testing--quality-assurance)
12. [Deployment](#12-deployment)

---

## Implementation Phases Overview

### Phase 1: Foundation (Week 1-2)
- Project setup
- Authentication system
- Basic UI layout
- Database setup

### Phase 2: Core Features (Week 3-5)
- Bucket management
- Object upload/download
- Access keys
- Dashboard

### Phase 3: Advanced Features (Week 6-8)
- Multipart upload
- Presigned URLs
- Bucket policies & CORS
- Analytics

### Phase 4: Polish & Deployment (Week 9-10)
- User management (admin)
- Testing
- Documentation
- Production deployment

---

## 1. Project Setup

### 1.1 Prerequisites

**Required Tools**:
- Node.js 20+ (LTS)
- pnpm 9+
- PostgreSQL 16+
- Redis 7+
- Docker & Docker Compose (for deployment)
- Git

**Recommended IDE**:
- VS Code with extensions:
  - ESLint
  - Prettier
  - Prisma
  - TypeScript
  - Tailwind CSS IntelliSense

### 1.2 Initial Setup

**Step 1: Clone Repository**

```bash
git clone https://github.com/sorathiyavatsal/v2-Bucket.git
cd v2-Bucket
```

**Step 2: Install Dependencies**

```bash
# Install pnpm globally (if not installed)
npm install -g pnpm@9

# Install project dependencies
pnpm install
```

**Step 3: Environment Configuration**

Create `.env` file in project root:

```env
# Database
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/v2bucket

# Redis
REDIS_URL=redis://localhost:6379

# Authentication
AUTH_SECRET=your-random-secret-key-min-32-chars
AUTH_URL=http://localhost:3000

# Email (for password reset)
RESEND_API_KEY=your-resend-api-key
RESEND_FROM_EMAIL=V2-Bucket <noreply@yourdomain.com>

# Storage
STORAGE_PATH=./storage

# CORS
CORS_ORIGIN=http://localhost:3001

# API Configuration
NEXT_PUBLIC_API_URL=http://localhost:3000

# Better Auth
BETTER_AUTH_SECRET=your-random-secret-key-min-32-chars
BETTER_AUTH_URL=http://localhost:3001

# AWS/S3 (optional for testing)
DEFAULT_REGION=us-east-1
DEFAULT_STORAGE_CLASS=STANDARD
```

**Step 4: Database Setup**

```bash
# Navigate to database package
cd packages/database

# Generate Prisma client
pnpm exec prisma generate

# Run migrations
pnpm exec prisma migrate dev

# Seed database (optional)
pnpm exec prisma db seed
```

**Step 5: Start Development Servers**

```bash
# Terminal 1: API Server
cd apps/api
pnpm dev

# Terminal 2: Web Application
cd apps/web
pnpm dev
```

**Verify Setup**:
- API: http://localhost:3000/health
- Web: http://localhost:3001

---

## 2. Authentication System

**Priority**: High | **Complexity**: Medium | **Duration**: 3-5 days

### 2.1 Database Schema

**Already Implemented** ✅

Tables:
- `User` - User accounts
- `Session` - User sessions
- `Account` - OAuth accounts
- `Verification` - Email verification
- `TwoFactor` - 2FA support

**File**: `packages/database/prisma/schema.prisma`

### 2.2 Backend Implementation

#### Task 2.2.1: Setup Better-Auth

**File**: `apps/api/src/lib/auth.ts`

**Status**: Already implemented ✅

**Features**:
- Email/password authentication
- OAuth (GitHub, Google)
- Session management
- Password reset
- Email verification

**Verify**:
```bash
curl http://localhost:3000/api/auth/get-session
```

#### Task 2.2.2: Authentication Middleware

**File**: `apps/api/src/middleware/auth.ts`

**Implementation**:
```typescript
import { Context, Next } from 'hono';
import { auth } from '../lib/auth';

export async function authMiddleware(c: Context, next: Next) {
  const session = await auth.api.getSession({
    headers: c.req.raw.headers
  });

  if (!session) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  c.set('user', session.user);
  c.set('session', session.session);
  await next();
}

export async function optionalAuthMiddleware(c: Context, next: Next) {
  try {
    const session = await auth.api.getSession({
      headers: c.req.raw.headers
    });
    if (session) {
      c.set('user', session.user);
      c.set('session', session.session);
    }
  } catch (error) {
    // Continue without auth
  }
  await next();
}
```

**Apply Middleware**:
```typescript
// In apps/api/src/index.ts
import { authMiddleware } from './middleware/auth';

// Protect all /trpc routes
app.use('/trpc/*', authMiddleware);
```

#### Task 2.2.3: tRPC Auth Router

**File**: `apps/api/src/trpc/routers/auth.ts`

**Status**: Already implemented ✅

**Endpoints**:
- `auth.register` - Register new user
- `auth.login` - Login user
- `auth.logout` - Logout user
- `auth.me` - Get current user
- `auth.updateProfile` - Update profile
- `auth.changePassword` - Change password
- `auth.getSessions` - List sessions
- `auth.revokeSession` - Revoke session
- `auth.revokeAllSessions` - Revoke all sessions

**Test Registration**:
```bash
curl -X POST http://localhost:3000/trpc/auth.register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123",
    "name": "Test User"
  }'
```

### 2.3 Frontend Implementation

#### Task 2.3.1: Auth Context Provider

**File**: `apps/web/src/components/providers/AuthProvider.tsx`

**Implementation**:
```typescript
'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { trpc } from '@/lib/trpc';

interface User {
  id: string;
  email: string;
  name: string | null;
  isAdmin: boolean;
}

interface AuthContext {
  user: User | null;
  isLoading: boolean;
  refetch: () => void;
}

const AuthContext = createContext<AuthContext | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { data: user, isLoading, refetch } = trpc.auth.me.useQuery();

  return (
    <AuthContext.Provider value={{ user: user || null, isLoading, refetch }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
```

**Apply Provider**:

**File**: `apps/web/src/app/layout.tsx`

```typescript
import { AuthProvider } from '@/components/providers/AuthProvider';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
```

#### Task 2.3.2: Login Page

**File**: `apps/web/src/app/page.tsx`

**Implementation**:
```typescript
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const loginMutation = trpc.auth.login.useMutation({
    onSuccess: () => {
      router.push('/app');
    },
    onError: (error) => {
      setError(error.message);
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    loginMutation.mutate({ email, password });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8 p-8 bg-white rounded-lg shadow">
        <h2 className="text-3xl font-bold text-center">Sign In</h2>

        {error && (
          <div className="bg-red-50 text-red-500 p-3 rounded">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <Input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <Button
            type="submit"
            className="w-full"
            disabled={loginMutation.isLoading}
          >
            {loginMutation.isLoading ? 'Signing in...' : 'Sign In'}
          </Button>
        </form>

        <div className="text-center space-y-2">
          <a href="/auth/signup" className="text-blue-600 hover:underline">
            Create an account
          </a>
          <br />
          <a href="/auth/forgot-password" className="text-gray-600 hover:underline">
            Forgot password?
          </a>
        </div>
      </div>
    </div>
  );
}
```

#### Task 2.3.3: Signup Page

**File**: `apps/web/src/app/auth/signup/page.tsx`

Similar to login page, but using `auth.register` mutation.

#### Task 2.3.4: Forgot Password Page

**File**: `apps/web/src/app/auth/forgot-password/page.tsx`

Call Better-Auth forgot password endpoint.

#### Task 2.3.5: Protected Route Wrapper

**File**: `apps/web/src/components/auth/ProtectedRoute.tsx`

```typescript
'use client';

import { useAuth } from '@/components/providers/AuthProvider';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/');
    }
  }, [user, isLoading, router]);

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (!user) {
    return null;
  }

  return <>{children}</>;
}
```

**Apply to Protected Pages**:

**File**: `apps/web/src/app/app/layout.tsx`

```typescript
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';

export default function AppLayout({ children }) {
  return (
    <ProtectedRoute>
      {children}
    </ProtectedRoute>
  );
}
```

### 2.4 Testing Authentication

**Test Cases**:
1. ✅ User registration with valid email/password
2. ✅ User login with valid credentials
3. ❌ Login with invalid credentials (should fail)
4. ✅ Access protected route when authenticated
5. ❌ Access protected route when not authenticated (should redirect)
6. ✅ Logout and clear session
7. ✅ Password reset flow

**Manual Testing**:
```bash
# Register user
curl -X POST http://localhost:3000/api/auth/sign-up/email \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Test123!","name":"Test User"}'

# Login
curl -X POST http://localhost:3000/api/auth/sign-in/email \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Test123!"}'
```

---

## 3. Dashboard & Analytics

**Priority**: Medium | **Complexity**: Low | **Duration**: 2-3 days

### 3.1 Backend Implementation

#### Task 3.1.1: Bucket Statistics Endpoint

**File**: `apps/api/src/trpc/routers/bucket.ts`

**Status**: Already implemented ✅

```typescript
getStats: protectedProcedure.query(async ({ ctx }) => {
  const user = ctx.user;

  const buckets = await db.bucket.findMany({
    where: { userId: user.id }
  });

  const totalObjects = buckets.reduce((sum, b) => sum + b.objectCount, 0);
  const totalSize = buckets.reduce((sum, b) => sum + Number(b.totalSize), 0);

  return {
    totalBuckets: buckets.length,
    totalObjects,
    totalSize,
    totalSizeFormatted: formatBytes(totalSize),
    storageQuota: Number(user.storageQuota),
    storageQuotaFormatted: formatBytes(Number(user.storageQuota)),
    usedPercentage: (totalSize / Number(user.storageQuota)) * 100,
    availableStorage: Number(user.storageQuota) - totalSize,
    availableStorageFormatted: formatBytes(Number(user.storageQuota) - totalSize)
  };
})
```

#### Task 3.1.2: Metrics Endpoint

**File**: `apps/api/src/routes/metrics.ts`

**Status**: Already implemented ✅

```typescript
import { Hono } from 'hono';
import { prometheusMetrics } from '../lib/metrics';

const app = new Hono();

// Prometheus format
app.get('/metrics', (c) => {
  return c.text(prometheusMetrics.metrics());
});

// JSON format
app.get('/metrics/json', async (c) => {
  const metrics = await prometheusMetrics.getJSON();
  return c.json(metrics);
});

export default app;
```

### 3.2 Frontend Implementation

#### Task 3.2.1: Dashboard Page

**File**: `apps/web/src/app/app/page.tsx`

**Implementation**:
```typescript
'use client';

import { trpc } from '@/lib/trpc';
import { Card } from '@/components/ui/Card';
import { Database, HardDrive, FileText, Activity } from 'lucide-react';

export default function DashboardPage() {
  const { data: stats, isLoading } = trpc.bucket.getStats.useQuery();
  const { data: buckets } = trpc.bucket.list.useQuery();

  if (isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Dashboard</h1>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <div className="flex items-center space-x-4">
            <Database className="w-10 h-10 text-blue-500" />
            <div>
              <p className="text-sm text-gray-500">Total Buckets</p>
              <p className="text-2xl font-bold">{stats?.totalBuckets || 0}</p>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center space-x-4">
            <FileText className="w-10 h-10 text-green-500" />
            <div>
              <p className="text-sm text-gray-500">Total Objects</p>
              <p className="text-2xl font-bold">{stats?.totalObjects || 0}</p>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center space-x-4">
            <HardDrive className="w-10 h-10 text-purple-500" />
            <div>
              <p className="text-sm text-gray-500">Storage Used</p>
              <p className="text-2xl font-bold">{stats?.totalSizeFormatted}</p>
              <p className="text-xs text-gray-400">
                {stats?.usedPercentage.toFixed(1)}% of {stats?.storageQuotaFormatted}
              </p>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center space-x-4">
            <Activity className="w-10 h-10 text-orange-500" />
            <div>
              <p className="text-sm text-gray-500">Available Storage</p>
              <p className="text-2xl font-bold">{stats?.availableStorageFormatted}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Recent Buckets */}
      <Card>
        <h2 className="text-xl font-semibold mb-4">Recent Buckets</h2>
        <div className="space-y-2">
          {buckets?.slice(0, 5).map((bucket) => (
            <div
              key={bucket.id}
              className="flex justify-between items-center p-3 bg-gray-50 rounded"
            >
              <div>
                <p className="font-medium">{bucket.name}</p>
                <p className="text-sm text-gray-500">
                  {bucket.objectCount} objects • {bucket.totalSizeFormatted}
                </p>
              </div>
              <a
                href={`/app/buckets/${bucket.name}`}
                className="text-blue-600 hover:underline"
              >
                View
              </a>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
```

#### Task 3.2.2: Storage Quota Progress Bar

**Component**: `apps/web/src/components/dashboard/StorageQuota.tsx`

```typescript
interface StorageQuotaProps {
  used: number;
  total: number;
}

export function StorageQuota({ used, total }: StorageQuotaProps) {
  const percentage = (used / total) * 100;
  const color = percentage > 90 ? 'bg-red-500' : percentage > 70 ? 'bg-yellow-500' : 'bg-green-500';

  return (
    <div className="w-full">
      <div className="flex justify-between text-sm mb-1">
        <span>Storage Used</span>
        <span>{percentage.toFixed(1)}%</span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div
          className={`h-2 rounded-full ${color}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
```

#### Task 3.2.3: Analytics Page

**File**: `apps/web/src/app/app/analytics/page.tsx`

**Implementation**:
```typescript
'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card';

export default function AnalyticsPage() {
  const [metrics, setMetrics] = useState<any>(null);

  useEffect(() => {
    fetch('/api/metrics/json')
      .then(res => res.json())
      .then(data => setMetrics(data));
  }, []);

  if (!metrics) {
    return <div>Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Analytics</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <h3 className="font-semibold mb-2">API Requests</h3>
          <p className="text-3xl font-bold">{metrics.api?.requests_total || 0}</p>
        </Card>

        <Card>
          <h3 className="font-semibold mb-2">Errors</h3>
          <p className="text-3xl font-bold text-red-500">
            {metrics.api?.errors_total || 0}
          </p>
        </Card>

        <Card>
          <h3 className="font-semibold mb-2">Avg Latency</h3>
          <p className="text-3xl font-bold">
            {metrics.api?.latency_avg?.toFixed(2) || 0}ms
          </p>
        </Card>
      </div>

      {/* Add charts here using a library like Recharts or Chart.js */}
    </div>
  );
}
```

---

## 4. Bucket Management

**Priority**: High | **Complexity**: Medium | **Duration**: 4-5 days

### 4.1 Backend Implementation

#### Task 4.1.1: Bucket Router

**File**: `apps/api/src/trpc/routers/bucket.ts`

**Status**: Already implemented ✅

**Key Methods**:
- `create` - Create bucket
- `list` - List user buckets
- `get` - Get bucket details
- `delete` - Delete bucket
- `updateConfig` - Update bucket configuration
- `checkAvailability` - Check if bucket name is available

#### Task 4.1.2: Bucket Validation

**File**: `apps/api/src/lib/validators/bucket.ts`

```typescript
import { z } from 'zod';

export const bucketNameSchema = z
  .string()
  .min(3, 'Bucket name must be at least 3 characters')
  .max(63, 'Bucket name must be at most 63 characters')
  .regex(
    /^[a-z0-9][a-z0-9-]*[a-z0-9]$/,
    'Bucket name must start and end with a letter or number, and contain only lowercase letters, numbers, and hyphens'
  )
  .refine(
    (name) => !name.includes('--'),
    'Bucket name cannot contain consecutive hyphens'
  )
  .refine(
    (name) => !name.startsWith('xn--'),
    'Bucket name cannot start with xn--'
  );

export const createBucketSchema = z.object({
  name: bucketNameSchema,
  region: z.string().optional(),
  storageClass: z.enum(['STANDARD', 'GLACIER']).optional(),
  acl: z.enum(['private', 'public-read', 'public-read-write']).optional()
});
```

#### Task 4.1.3: Physical Storage Management

**File**: `apps/api/src/lib/storage.ts`

```typescript
import fs from 'fs/promises';
import path from 'path';

export class StorageManager {
  private baseStoragePath: string;

  constructor(baseStoragePath: string = process.env.STORAGE_PATH || './storage') {
    this.baseStoragePath = baseStoragePath;
  }

  async createBucketDirectory(userId: string, bucketName: string): Promise<string> {
    const bucketPath = path.join(this.baseStoragePath, userId, bucketName);
    await fs.mkdir(bucketPath, { recursive: true });
    return bucketPath;
  }

  async deleteBucketDirectory(volumePath: string): Promise<void> {
    await fs.rm(volumePath, { recursive: true, force: true });
  }

  async bucketExists(volumePath: string): Promise<boolean> {
    try {
      await fs.access(volumePath);
      return true;
    } catch {
      return false;
    }
  }

  async isBucketEmpty(volumePath: string): Promise<boolean> {
    const files = await fs.readdir(volumePath);
    return files.length === 0;
  }
}
```

### 4.2 Frontend Implementation

#### Task 4.2.1: Buckets List Page

**File**: `apps/web/src/app/app/buckets/page.tsx`

```typescript
'use client';

import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/Button';
import { BucketCard } from '@/components/buckets/BucketCard';
import { CreateBucketDialog } from '@/components/buckets/CreateBucketDialog';

export default function BucketsPage() {
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const { data: buckets, isLoading, refetch } = trpc.bucket.list.useQuery();

  if (isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Buckets</h1>
        <Button onClick={() => setShowCreateDialog(true)}>
          Create Bucket
        </Button>
      </div>

      {buckets?.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500 mb-4">No buckets yet</p>
          <Button onClick={() => setShowCreateDialog(true)}>
            Create Your First Bucket
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {buckets?.map((bucket) => (
            <BucketCard key={bucket.id} bucket={bucket} onDelete={refetch} />
          ))}
        </div>
      )}

      <CreateBucketDialog
        open={showCreateDialog}
        onClose={() => setShowCreateDialog(false)}
        onSuccess={refetch}
      />
    </div>
  );
}
```

#### Task 4.2.2: Bucket Card Component

**File**: `apps/web/src/components/buckets/BucketCard.tsx`

```typescript
import { Bucket } from '@/types';
import { Card } from '@/components/ui/Card';
import { Database, Calendar, HardDrive } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface BucketCardProps {
  bucket: Bucket;
  onDelete: () => void;
}

export function BucketCard({ bucket, onDelete }: BucketCardProps) {
  return (
    <Card className="hover:shadow-lg transition-shadow">
      <a href={`/app/buckets/${bucket.name}`}>
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center space-x-3">
            <Database className="w-8 h-8 text-blue-500" />
            <div>
              <h3 className="font-semibold text-lg">{bucket.name}</h3>
              <p className="text-sm text-gray-500">{bucket.region}</p>
            </div>
          </div>
          <span className="px-2 py-1 bg-gray-100 text-xs rounded">
            {bucket.acl}
          </span>
        </div>

        <div className="space-y-2">
          <div className="flex items-center text-sm text-gray-600">
            <HardDrive className="w-4 h-4 mr-2" />
            <span>{bucket.objectCount} objects • {bucket.totalSizeFormatted}</span>
          </div>

          <div className="flex items-center text-sm text-gray-600">
            <Calendar className="w-4 h-4 mr-2" />
            <span>
              Updated {formatDistanceToNow(new Date(bucket.updatedAt), { addSuffix: true })}
            </span>
          </div>
        </div>
      </a>
    </Card>
  );
}
```

#### Task 4.2.3: Create Bucket Dialog

**File**: `apps/web/src/components/buckets/CreateBucketDialog.tsx`

```typescript
'use client';

import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { Dialog } from '@/components/ui/Dialog';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';

interface CreateBucketDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function CreateBucketDialog({ open, onClose, onSuccess }: CreateBucketDialogProps) {
  const [name, setName] = useState('');
  const [region, setRegion] = useState('us-east-1');
  const [storageClass, setStorageClass] = useState('STANDARD');
  const [acl, setAcl] = useState('private');
  const [error, setError] = useState('');

  const createMutation = trpc.bucket.create.useMutation({
    onSuccess: () => {
      onSuccess();
      onClose();
      setName('');
      setError('');
    },
    onError: (error) => {
      setError(error.message);
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    createMutation.mutate({ name, region, storageClass, acl });
  };

  return (
    <Dialog open={open} onClose={onClose}>
      <h2 className="text-2xl font-bold mb-4">Create Bucket</h2>

      {error && (
        <div className="bg-red-50 text-red-500 p-3 rounded mb-4">{error}</div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Bucket Name</label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value.toLowerCase())}
            placeholder="my-bucket-name"
            required
            pattern="^[a-z0-9][a-z0-9-]*[a-z0-9]$"
            minLength={3}
            maxLength={63}
          />
          <p className="text-xs text-gray-500 mt-1">
            3-63 characters, lowercase, numbers, and hyphens only
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Region</label>
          <Select value={region} onChange={(e) => setRegion(e.target.value)}>
            <option value="us-east-1">US East (N. Virginia)</option>
            <option value="us-west-2">US West (Oregon)</option>
            <option value="eu-west-1">Europe (Ireland)</option>
            <option value="ap-south-1">Asia Pacific (Mumbai)</option>
          </Select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Storage Class</label>
          <Select value={storageClass} onChange={(e) => setStorageClass(e.target.value)}>
            <option value="STANDARD">Standard</option>
            <option value="GLACIER">Glacier (Archive)</option>
          </Select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Access Control</label>
          <Select value={acl} onChange={(e) => setAcl(e.target.value)}>
            <option value="private">Private</option>
            <option value="public-read">Public Read</option>
            <option value="public-read-write">Public Read-Write</option>
          </Select>
        </div>

        <div className="flex space-x-3">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={createMutation.isLoading}>
            {createMutation.isLoading ? 'Creating...' : 'Create Bucket'}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
```

#### Task 4.2.4: Bucket Details Page

**File**: `apps/web/src/app/app/buckets/[name]/page.tsx`

```typescript
'use client';

import { trpc } from '@/lib/trpc';
import { useParams } from 'next/navigation';
import { Card } from '@/components/ui/Card';
import { ObjectList } from '@/components/buckets/ObjectList';
import { Button } from '@/components/ui/Button';

export default function BucketDetailsPage() {
  const params = useParams();
  const bucketName = params.name as string;

  const { data: bucket, isLoading } = trpc.bucket.get.useQuery({ name: bucketName });

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (!bucket) {
    return <div>Bucket not found</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">{bucket.name}</h1>
          <p className="text-gray-500">{bucket.region}</p>
        </div>
        <Button>Upload Object</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <p className="text-sm text-gray-500">Objects</p>
          <p className="text-2xl font-bold">{bucket.objectCount}</p>
        </Card>
        <Card>
          <p className="text-sm text-gray-500">Size</p>
          <p className="text-2xl font-bold">{bucket.totalSizeFormatted}</p>
        </Card>
        <Card>
          <p className="text-sm text-gray-500">Storage Class</p>
          <p className="text-lg font-semibold">{bucket.storageClass}</p>
        </Card>
        <Card>
          <p className="text-sm text-gray-500">Access Control</p>
          <p className="text-lg font-semibold">{bucket.acl}</p>
        </Card>
      </div>

      <Card>
        <h2 className="text-xl font-semibold mb-4">Objects</h2>
        <ObjectList bucketName={bucketName} />
      </Card>
    </div>
  );
}
```

### 4.3 Testing Bucket Management

**Test Cases**:
1. ✅ Create bucket with valid name
2. ❌ Create bucket with invalid name (should fail)
3. ❌ Create duplicate bucket (should fail)
4. ✅ List user buckets
5. ✅ View bucket details
6. ✅ Update bucket configuration
7. ✅ Delete empty bucket
8. ❌ Delete non-empty bucket (should fail unless force=true)

---

## 5. Object Operations

**Priority**: High | **Complexity**: High | **Duration**: 5-7 days

### 5.1 Backend Implementation

#### Task 5.1.1: File Upload Handler

**File**: `apps/api/src/routes/upload.ts`

```typescript
import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth';
import multer from 'multer';
import { randomBytes } from 'crypto';
import path from 'path';

const upload = multer({
  dest: '/tmp/uploads',
  limits: {
    fileSize: 5 * 1024 * 1024 * 1024 // 5GB max
  }
});

const app = new Hono();

app.use('*', authMiddleware);

// Temporary file upload (for frontend)
app.post('/upload/temp', upload.single('file'), async (c) => {
  const file = c.req.file;
  if (!file) {
    return c.json({ error: 'No file provided' }, 400);
  }

  return c.json({
    tempPath: file.path,
    originalName: file.originalname,
    size: file.size,
    mimeType: file.mimetype
  });
});

export default app;
```

#### Task 5.1.2: Object Router

**File**: `apps/api/src/trpc/routers/object.ts`

**Status**: Already implemented ✅

**Key Methods**:
- `upload` - Upload object to bucket
- `getMetadata` - Get object metadata
- `list` - List objects in bucket
- `delete` - Delete object
- `updateMetadata` - Update object metadata
- `copy` - Copy object

#### Task 5.1.3: Storage Operations

**File**: `apps/api/src/lib/storage.ts` (continued)

```typescript
export class StorageManager {
  // ... previous methods

  async saveObject(
    volumePath: string,
    key: string,
    tempFilePath: string
  ): Promise<string> {
    const objectPath = path.join(volumePath, key);
    const objectDir = path.dirname(objectPath);

    // Create directory structure
    await fs.mkdir(objectDir, { recursive: true });

    // Move file from temp location
    await fs.rename(tempFilePath, objectPath);

    return objectPath;
  }

  async getObject(volumePath: string, key: string): Promise<Buffer> {
    const objectPath = path.join(volumePath, key);
    return await fs.readFile(objectPath);
  }

  async deleteObject(volumePath: string, key: string): Promise<void> {
    const objectPath = path.join(volumePath, key);
    await fs.unlink(objectPath);
  }

  async copyObject(
    sourceVolumePath: string,
    sourceKey: string,
    destVolumePath: string,
    destKey: string
  ): Promise<void> {
    const sourcePath = path.join(sourceVolumePath, sourceKey);
    const destPath = path.join(destVolumePath, destKey);
    const destDir = path.dirname(destPath);

    await fs.mkdir(destDir, { recursive: true });
    await fs.copyFile(sourcePath, destPath);
  }

  async getObjectSize(volumePath: string, key: string): Promise<number> {
    const objectPath = path.join(volumePath, key);
    const stats = await fs.stat(objectPath);
    return stats.size;
  }
}
```

### 5.2 Frontend Implementation

#### Task 5.2.1: Object List Component

**File**: `apps/web/src/components/buckets/ObjectList.tsx`

```typescript
'use client';

import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { FileText, Folder, Download, Trash2, Copy } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface ObjectListProps {
  bucketName: string;
}

export function ObjectList({ bucketName }: ObjectListProps) {
  const [prefix, setPrefix] = useState('');
  const [selectedObjects, setSelectedObjects] = useState<string[]>([]);

  const { data, isLoading, refetch } = trpc.object.list.useQuery({
    bucketName,
    prefix,
    delimiter: '/'
  });

  const deleteMutation = trpc.object.delete.useMutation({
    onSuccess: () => refetch()
  });

  const handleFolderClick = (folderPrefix: string) => {
    setPrefix(folderPrefix);
  };

  const handleDeleteObject = async (key: string) => {
    if (confirm(`Delete ${key}?`)) {
      await deleteMutation.mutateAsync({ bucketName, key });
    }
  };

  if (isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="space-y-4">
      {/* Breadcrumb Navigation */}
      {prefix && (
        <div className="flex items-center space-x-2 text-sm">
          <button
            onClick={() => setPrefix('')}
            className="text-blue-600 hover:underline"
          >
            Root
          </button>
          {prefix.split('/').filter(Boolean).map((part, index, arr) => (
            <span key={index}>
              /
              <button
                onClick={() => setPrefix(arr.slice(0, index + 1).join('/') + '/')}
                className="text-blue-600 hover:underline ml-2"
              >
                {part}
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Folders (Common Prefixes) */}
      {data?.commonPrefixes?.map((folderPrefix) => (
        <div
          key={folderPrefix}
          onClick={() => handleFolderClick(folderPrefix)}
          className="flex items-center justify-between p-3 bg-gray-50 rounded hover:bg-gray-100 cursor-pointer"
        >
          <div className="flex items-center space-x-3">
            <Folder className="w-5 h-5 text-yellow-500" />
            <span className="font-medium">
              {folderPrefix.replace(prefix, '').replace('/', '')}
            </span>
          </div>
        </div>
      ))}

      {/* Objects */}
      {data?.objects?.map((object) => (
        <div
          key={object.key}
          className="flex items-center justify-between p-3 bg-white border rounded hover:bg-gray-50"
        >
          <div className="flex items-center space-x-3">
            <FileText className="w-5 h-5 text-blue-500" />
            <div>
              <p className="font-medium">{object.key.replace(prefix, '')}</p>
              <p className="text-sm text-gray-500">
                {object.sizeFormatted} •{' '}
                {formatDistanceToNow(new Date(object.lastModified), { addSuffix: true })}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => {/* Download logic */}}
              className="p-2 hover:bg-gray-100 rounded"
              title="Download"
            >
              <Download className="w-4 h-4" />
            </button>
            <button
              onClick={() => {/* Copy logic */}}
              className="p-2 hover:bg-gray-100 rounded"
              title="Copy"
            >
              <Copy className="w-4 h-4" />
            </button>
            <button
              onClick={() => handleDeleteObject(object.key)}
              className="p-2 hover:bg-red-50 text-red-600 rounded"
              title="Delete"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      ))}

      {data?.objects?.length === 0 && data?.commonPrefixes?.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          No objects in this {prefix ? 'folder' : 'bucket'}
        </div>
      )}
    </div>
  );
}
```

#### Task 5.2.2: Upload Dialog

**File**: `apps/web/src/components/buckets/UploadDialog.tsx`

```typescript
'use client';

import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { Dialog } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { Upload } from 'lucide-react';

interface UploadDialogProps {
  open: boolean;
  onClose: () => void;
  bucketName: string;
  prefix?: string;
  onSuccess: () => void;
}

export function UploadDialog({
  open,
  onClose,
  bucketName,
  prefix = '',
  onSuccess
}: UploadDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [key, setKey] = useState('');
  const [uploading, setUploading] = useState(false);

  const uploadMutation = trpc.object.upload.useMutation({
    onSuccess: () => {
      onSuccess();
      onClose();
      setFile(null);
      setKey('');
    }
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setKey(prefix + selectedFile.name);
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    setUploading(true);

    try {
      // 1. Upload file to temp endpoint
      const formData = new FormData();
      formData.append('file', file);

      const tempResponse = await fetch('/api/upload/temp', {
        method: 'POST',
        body: formData
      });

      const { tempPath } = await tempResponse.json();

      // 2. Create object in bucket
      await uploadMutation.mutateAsync({
        bucketName,
        key,
        filePath: tempPath,
        contentType: file.type
      });
    } catch (error) {
      console.error('Upload failed:', error);
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose}>
      <h2 className="text-2xl font-bold mb-4">Upload Object</h2>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Select File</label>
          <input
            type="file"
            onChange={handleFileChange}
            className="w-full"
          />
        </div>

        {file && (
          <div>
            <label className="block text-sm font-medium mb-1">Object Key</label>
            <input
              type="text"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              className="w-full border rounded px-3 py-2"
            />
            <p className="text-xs text-gray-500 mt-1">
              File path in bucket (e.g., photos/image.jpg)
            </p>
          </div>
        )}

        <div className="flex space-x-3">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleUpload}
            disabled={!file || uploading}
          >
            {uploading ? 'Uploading...' : 'Upload'}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
```

#### Task 5.2.3: Download Object

**Implementation**: Generate presigned URL and download

```typescript
const downloadObject = async (bucketName: string, key: string) => {
  // Generate presigned URL
  const { url } = await trpc.presignedUrl.generateGetUrl.mutate({
    bucketName,
    key,
    expiresIn: 3600 // 1 hour
  });

  // Download file
  const link = document.createElement('a');
  link.href = url;
  link.download = key.split('/').pop() || 'download';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};
```

### 5.3 Testing Object Operations

**Test Cases**:
1. ✅ Upload small file (<5MB)
2. ✅ Upload file with metadata
3. ✅ List objects in bucket
4. ✅ List objects with prefix (folder simulation)
5. ✅ Download object
6. ✅ Copy object (same bucket)
7. ✅ Copy object (different bucket)
8. ✅ Update object metadata
9. ✅ Delete object
10. ❌ Upload file exceeding quota (should fail)

---

## 6. Access Keys Management

**Priority**: High | **Complexity**: Medium | **Duration**: 2-3 days

### 6.1 Backend Implementation

**Status**: Already implemented ✅

**File**: `apps/api/src/trpc/routers/access-key.ts`

### 6.2 Frontend Implementation

#### Task 6.2.1: Access Keys Page

**File**: `apps/web/src/app/app/access-keys/page.tsx`

```typescript
'use client';

import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Key, Eye, EyeOff, Trash2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

export default function AccessKeysPage() {
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newKey, setNewKey] = useState<any>(null);

  const { data: keys, refetch } = trpc.accessKey.list.useQuery({});

  const createMutation = trpc.accessKey.create.useMutation({
    onSuccess: (data) => {
      setNewKey(data);
      refetch();
    }
  });

  const deleteMutation = trpc.accessKey.delete.useMutation({
    onSuccess: () => refetch()
  });

  const handleCreate = () => {
    const name = prompt('Access key name (optional):');
    createMutation.mutate({ name: name || undefined });
  };

  const handleDelete = async (id: string) => {
    if (confirm('Delete this access key? Applications using it will stop working.')) {
      await deleteMutation.mutateAsync({ id });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Access Keys</h1>
        <Button onClick={handleCreate}>Create Access Key</Button>
      </div>

      {/* New Key Alert (shown once after creation) */}
      {newKey && (
        <Card className="bg-yellow-50 border-yellow-200">
          <h3 className="font-semibold text-yellow-800 mb-2">
            Access Key Created - Save These Credentials Now!
          </h3>
          <p className="text-sm text-yellow-700 mb-4">
            This is the only time you will see the secret key. Store it securely.
          </p>
          <div className="space-y-2 font-mono text-sm">
            <div>
              <strong>Access Key ID:</strong>
              <div className="bg-white p-2 rounded mt-1">{newKey.accessKeyId}</div>
            </div>
            <div>
              <strong>Secret Access Key:</strong>
              <div className="bg-white p-2 rounded mt-1">{newKey.secretAccessKey}</div>
            </div>
          </div>
          <Button
            onClick={() => setNewKey(null)}
            className="mt-4"
            variant="secondary"
          >
            I've Saved the Credentials
          </Button>
        </Card>
      )}

      {/* Access Keys List */}
      <div className="space-y-4">
        {keys?.map((key) => (
          <Card key={key.id}>
            <div className="flex justify-between items-start">
              <div className="flex items-start space-x-3">
                <Key className="w-5 h-5 text-blue-500 mt-1" />
                <div>
                  <p className="font-semibold">{key.name || 'Unnamed Key'}</p>
                  <p className="font-mono text-sm text-gray-600">{key.accessKeyId}</p>
                  <div className="flex items-center space-x-4 text-sm text-gray-500 mt-2">
                    <span className={key.isActive ? 'text-green-600' : 'text-red-600'}>
                      {key.isActive ? 'Active' : 'Inactive'}
                    </span>
                    {key.lastUsedAt && (
                      <span>
                        Last used {formatDistanceToNow(new Date(key.lastUsedAt), { addSuffix: true })}
                      </span>
                    )}
                    <span>
                      Created {formatDistanceToNow(new Date(key.createdAt), { addSuffix: true })}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {/* Toggle active */}}
                >
                  {key.isActive ? 'Deactivate' : 'Activate'}
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => handleDelete(key.id)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {keys?.length === 0 && (
        <div className="text-center py-12">
          <Key className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 mb-4">No access keys yet</p>
          <Button onClick={handleCreate}>Create Your First Access Key</Button>
        </div>
      )}
    </div>
  );
}
```

### 6.3 Testing Access Keys

**Test Cases**:
1. ✅ Create access key
2. ✅ View secret key (only once)
3. ✅ List access keys
4. ✅ Activate/deactivate key
5. ✅ Delete access key
6. ✅ Use key with S3 API
7. ❌ Create more than 10 keys (should fail)
8. ❌ Use inactive key (should fail)

---

## 7. Presigned URLs

**Priority**: Medium | **Complexity**: Medium | **Duration**: 2-3 days

### 7.1 Backend Implementation

**Status**: Already implemented ✅

**File**: `apps/api/src/trpc/routers/presigned-url.ts`

### 7.2 Frontend Implementation

#### Task 7.2.1: Generate Presigned URL Dialog

**File**: `apps/web/src/components/objects/GeneratePresignedUrlDialog.tsx`

```typescript
'use client';

import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { Dialog } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { Copy, Check } from 'lucide-react';

interface GeneratePresignedUrlDialogProps {
  open: boolean;
  onClose: () => void;
  bucketName: string;
  objectKey: string;
}

export function GeneratePresignedUrlDialog({
  open,
  onClose,
  bucketName,
  objectKey
}: GeneratePresignedUrlDialogProps) {
  const [operation, setOperation] = useState<'GET' | 'PUT' | 'DELETE'>('GET');
  const [expiresIn, setExpiresIn] = useState(3600); // 1 hour
  const [generatedUrl, setGeneratedUrl] = useState('');
  const [copied, setCopied] = useState(false);

  const generateGetUrl = trpc.presignedUrl.generateGetUrl.useMutation({
    onSuccess: (data) => setGeneratedUrl(data.url)
  });

  const generatePutUrl = trpc.presignedUrl.generatePutUrl.useMutation({
    onSuccess: (data) => setGeneratedUrl(data.url)
  });

  const generateDeleteUrl = trpc.presignedUrl.generateDeleteUrl.useMutation({
    onSuccess: (data) => setGeneratedUrl(data.url)
  });

  const handleGenerate = () => {
    setGeneratedUrl('');
    const params = { bucketName, key: objectKey, expiresIn };

    switch (operation) {
      case 'GET':
        generateGetUrl.mutate(params);
        break;
      case 'PUT':
        generatePutUrl.mutate(params);
        break;
      case 'DELETE':
        generateDeleteUrl.mutate(params);
        break;
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(generatedUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={open} onClose={onClose}>
      <h2 className="text-2xl font-bold mb-4">Generate Presigned URL</h2>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Operation</label>
          <select
            value={operation}
            onChange={(e) => setOperation(e.target.value as any)}
            className="w-full border rounded px-3 py-2"
          >
            <option value="GET">GET (Download)</option>
            <option value="PUT">PUT (Upload)</option>
            <option value="DELETE">DELETE</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Expires In</label>
          <select
            value={expiresIn}
            onChange={(e) => setExpiresIn(Number(e.target.value))}
            className="w-full border rounded px-3 py-2"
          >
            <option value={300}>5 minutes</option>
            <option value={900}>15 minutes</option>
            <option value={1800}>30 minutes</option>
            <option value={3600}>1 hour</option>
            <option value={21600}>6 hours</option>
            <option value={86400}>24 hours</option>
            <option value={604800}>7 days</option>
          </select>
        </div>

        <Button onClick={handleGenerate} className="w-full">
          Generate URL
        </Button>

        {generatedUrl && (
          <div>
            <label className="block text-sm font-medium mb-1">Presigned URL</label>
            <div className="flex items-center space-x-2">
              <input
                type="text"
                value={generatedUrl}
                readOnly
                className="flex-1 border rounded px-3 py-2 text-sm"
              />
              <Button onClick={handleCopy} size="sm">
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              </Button>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              This URL will expire in {expiresIn / 3600} hours
            </p>
          </div>
        )}
      </div>
    </Dialog>
  );
}
```

---

## 8. Multipart Upload

**Priority**: Medium | **Complexity**: High | **Duration**: 4-5 days

### 8.1 Backend Implementation

**Status**: Already implemented ✅

**File**: `apps/api/src/trpc/routers/multipart.ts`

### 8.2 Frontend Implementation

#### Task 8.2.1: Multipart Upload Component

**File**: `apps/web/src/components/upload/MultipartUpload.tsx`

```typescript
'use client';

import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/Button';
import { Progress } from '@/components/ui/Progress';

const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB

interface MultipartUploadProps {
  bucketName: string;
  onSuccess: () => void;
}

export function MultipartUpload({ bucketName, onSuccess }: MultipartUploadProps) {
  const [file, setFile] = useState<File | null>(null);
  const [key, setKey] = useState('');
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const initiateMutation = trpc.multipart.initiate.useMutation();
  const uploadPartMutation = trpc.multipart.uploadPart.useMutation();
  const completeMutation = trpc.multipart.complete.useMutation();

  const handleUpload = async () => {
    if (!file) return;

    setUploading(true);
    setProgress(0);

    try {
      // 1. Initiate multipart upload
      const { uploadId } = await initiateMutation.mutateAsync({
        bucketName,
        key,
        contentType: file.type
      });

      // 2. Split file into chunks and upload
      const chunks = Math.ceil(file.size / CHUNK_SIZE);
      const parts = [];

      for (let i = 0; i < chunks; i++) {
        const start = i * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, file.size);
        const chunk = file.slice(start, end);

        // Upload chunk to temp
        const formData = new FormData();
        formData.append('file', chunk);

        const tempResponse = await fetch('/api/upload/temp', {
          method: 'POST',
          body: formData
        });

        const { tempPath } = await tempResponse.json();

        // Upload part
        const part = await uploadPartMutation.mutateAsync({
          bucketName,
          key,
          uploadId,
          partNumber: i + 1,
          filePath: tempPath
        });

        parts.push({
          partNumber: part.partNumber,
          etag: part.etag
        });

        setProgress(((i + 1) / chunks) * 100);
      }

      // 3. Complete multipart upload
      await completeMutation.mutateAsync({
        bucketName,
        key,
        uploadId,
        parts
      });

      onSuccess();
    } catch (error) {
      console.error('Multipart upload failed:', error);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-1">Select Large File</label>
        <input
          type="file"
          onChange={(e) => {
            const selectedFile = e.target.files?.[0];
            if (selectedFile) {
              setFile(selectedFile);
              setKey(selectedFile.name);
            }
          }}
          className="w-full"
        />
        {file && (
          <p className="text-sm text-gray-500 mt-1">
            Size: {(file.size / 1024 / 1024).toFixed(2)} MB
          </p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Object Key</label>
        <input
          type="text"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          className="w-full border rounded px-3 py-2"
        />
      </div>

      {uploading && (
        <div>
          <Progress value={progress} />
          <p className="text-sm text-gray-600 mt-2">
            Uploading: {progress.toFixed(0)}%
          </p>
        </div>
      )}

      <Button
        onClick={handleUpload}
        disabled={!file || uploading}
        className="w-full"
      >
        {uploading ? 'Uploading...' : 'Upload'}
      </Button>
    </div>
  );
}
```

---

## 9. Bucket Policies & CORS

**Priority**: Low | **Complexity**: Medium | **Duration**: 2-3 days

### 9.1 Backend Implementation

**Status**: Already implemented ✅

**File**: `apps/api/src/trpc/routers/bucket-policy.ts`

### 9.2 Frontend Implementation

#### Task 9.2.1: Bucket Policy Editor

**File**: `apps/web/src/components/buckets/PolicyEditor.tsx`

```typescript
'use client';

import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';

interface PolicyEditorProps {
  bucketName: string;
}

export function PolicyEditor({ bucketName }: PolicyEditorProps) {
  const { data: policy } = trpc.bucketPolicy.getPolicy.useQuery({ bucketName });
  const [customPolicy, setCustomPolicy] = useState('');

  const setPolicyMutation = trpc.bucketPolicy.setPolicy.useMutation();
  const setPrivateMutation = trpc.bucketPolicy.setPrivatePolicy.useMutation();
  const setPublicReadMutation = trpc.bucketPolicy.setPublicReadPolicy.useMutation();

  const handleSetCustomPolicy = async () => {
    try {
      const policyJson = JSON.parse(customPolicy);
      await setPolicyMutation.mutateAsync({ bucketName, policy: policyJson });
      alert('Policy updated');
    } catch (error) {
      alert('Invalid JSON');
    }
  };

  return (
    <Card>
      <h3 className="text-xl font-semibold mb-4">Bucket Policy</h3>

      <div className="space-y-4">
        {/* Quick Actions */}
        <div className="flex space-x-2">
          <Button
            onClick={() => setPrivateMutation.mutate({ bucketName })}
            variant="secondary"
          >
            Make Private
          </Button>
          <Button
            onClick={() => setPublicReadMutation.mutate({ bucketName })}
            variant="secondary"
          >
            Make Public (Read Only)
          </Button>
        </div>

        {/* Current Policy */}
        <div>
          <label className="block text-sm font-medium mb-1">Current Policy</label>
          <pre className="bg-gray-100 p-4 rounded text-sm overflow-auto max-h-64">
            {JSON.stringify(policy, null, 2)}
          </pre>
        </div>

        {/* Custom Policy */}
        <div>
          <label className="block text-sm font-medium mb-1">Custom Policy (JSON)</label>
          <textarea
            value={customPolicy}
            onChange={(e) => setCustomPolicy(e.target.value)}
            className="w-full border rounded px-3 py-2 font-mono text-sm"
            rows={10}
            placeholder='{"Version": "2012-10-17", "Statement": [...]}'
          />
        </div>

        <Button onClick={handleSetCustomPolicy}>
          Apply Custom Policy
        </Button>
      </div>
    </Card>
  );
}
```

---

## 10. User Management (Admin)

**Priority**: Low | **Complexity**: Low | **Duration**: 1-2 days

### 10.1 Admin Middleware

**File**: `apps/api/src/middleware/admin.ts`

```typescript
import { Context, Next } from 'hono';

export async function adminMiddleware(c: Context, next: Next) {
  const user = c.get('user');

  if (!user || !user.isAdmin) {
    return c.json({ error: 'Forbidden' }, 403);
  }

  await next();
}
```

### 10.2 User Management Page (Future)

To be implemented with admin-only user list, quotas management, etc.

---

## 11. Testing & Quality Assurance

### 11.1 Unit Tests

**Setup Jest**:

```bash
pnpm add -D jest @types/jest ts-jest
```

**Test Example** (`apps/api/src/lib/validators/bucket.test.ts`):

```typescript
import { bucketNameSchema } from './bucket';

describe('Bucket Name Validation', () => {
  it('should accept valid bucket name', () => {
    expect(() => bucketNameSchema.parse('my-bucket')).not.toThrow();
  });

  it('should reject name with uppercase', () => {
    expect(() => bucketNameSchema.parse('MyBucket')).toThrow();
  });

  it('should reject name too short', () => {
    expect(() => bucketNameSchema.parse('ab')).toThrow();
  });
});
```

### 11.2 Integration Tests

Test complete flows:
- User registration → bucket creation → object upload → download

### 11.3 E2E Tests (Playwright)

Test frontend flows through browser automation.

---

## 12. Deployment

### 12.1 Docker Deployment

**Status**: Already configured ✅

**File**: `docker-compose.yml`

**Deploy**:
```bash
cd /volume1/docker/v2-bucket
docker-compose up -d
```

### 12.2 Production Checklist

- [ ] Update environment variables for production
- [ ] Configure Tailscale for public access
- [ ] Set up SSL certificates
- [ ] Configure backups (PostgreSQL, Redis, Storage)
- [ ] Set up monitoring (metrics endpoint)
- [ ] Configure rate limiting
- [ ] Review security settings
- [ ] Set strong JWT secrets
- [ ] Configure CORS properly
- [ ] Test all features in production
- [ ] Document production URLs and credentials

---

## Implementation Priority Matrix

### Phase 1 (Weeks 1-2): Foundation
| Task | Priority | Complexity | Status |
|------|----------|------------|--------|
| Project Setup | High | Low | ✅ Done |
| Authentication Backend | High | Medium | ✅ Done |
| Authentication Frontend | High | Medium | 🔨 In Progress |
| Database Schema | High | Low | ✅ Done |

### Phase 2 (Weeks 3-5): Core Features
| Task | Priority | Complexity | Status |
|------|----------|------------|--------|
| Bucket Management Backend | High | Medium | ✅ Done |
| Bucket Management Frontend | High | Medium | 🔨 In Progress |
| Object Operations Backend | High | High | ✅ Done |
| Object Operations Frontend | High | High | ⏳ Pending |
| Dashboard | Medium | Low | ⏳ Pending |

### Phase 3 (Weeks 6-8): Advanced Features
| Task | Priority | Complexity | Status |
|------|----------|------------|--------|
| Access Keys | High | Medium | ⏳ Pending |
| Presigned URLs | Medium | Medium | ⏳ Pending |
| Multipart Upload | Medium | High | ⏳ Pending |
| Bucket Policies | Low | Medium | ⏳ Pending |
| Analytics | Low | Low | ⏳ Pending |

### Phase 4 (Weeks 9-10): Polish
| Task | Priority | Complexity | Status |
|------|----------|------------|--------|
| User Management | Low | Low | ⏳ Pending |
| Testing | High | Medium | ⏳ Pending |
| Documentation | Medium | Low | ⏳ Pending |
| Deployment | High | Low | ✅ Done |

---

**Document Version**: 1.0.0
**Last Updated**: 2025-11-10
**Next Review Date**: Weekly during development
