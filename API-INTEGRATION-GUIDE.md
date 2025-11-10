# V2-Bucket API Integration Guide

Complete reference for integrating with the V2-Bucket S3-compatible storage platform. This guide covers every page, feature, and API endpoint.

---

## Table of Contents

1. [Authentication & Session Management](#1-authentication--session-management)
2. [Dashboard & Analytics](#2-dashboard--analytics)
3. [Bucket Management](#3-bucket-management)
4. [Object Operations](#4-object-operations)
5. [Access Keys Management](#5-access-keys-management)
6. [Presigned URLs](#6-presigned-urls)
7. [Bucket Policies & CORS](#7-bucket-policies--cors)
8. [Multipart Upload](#8-multipart-upload)
9. [User Management](#9-user-management)
10. [S3-Compatible API](#10-s3-compatible-api)
11. [Error Handling](#11-error-handling)
12. [Rate Limits & Quotas](#12-rate-limits--quotas)

---

## API Base URLs

- **Web Application**: `https://v2bucket.discus-likert.ts.net/`
- **tRPC API**: `https://v2bucket.discus-likert.ts.net/api/trpc`
- **S3-Compatible API**: `https://v2bucket.discus-likert.ts.net/api/s3`
- **Authentication API**: `https://v2bucket.discus-likert.ts.net/api/auth`

---

## 1. Authentication & Session Management

### Pages

#### 1.1 Landing/Login Page (`/`)

**Purpose**: User login

**API Endpoints Used**:

```typescript
// Email/Password Login
POST /api/auth/sign-in/email
Request:
{
  "email": "user@example.com",
  "password": "password123"
}
Response:
{
  "user": {
    "id": "usr_xxx",
    "email": "user@example.com",
    "name": "John Doe",
    "isAdmin": false
  },
  "session": {
    "token": "session_token",
    "expiresAt": "2025-11-17T00:00:00Z"
  }
}
```

```typescript
// OAuth Login (GitHub, Google)
GET /api/auth/oauth/github
Response: Redirects to OAuth provider
```

```typescript
// Get Current Session
GET /api/auth/get-session
Response:
{
  "user": { /* user object */ },
  "session": { /* session object */ }
}
```

**tRPC Alternative**:

```typescript
// Login
trpc.auth.login.mutate({
  email: "user@example.com",
  password: "password123"
})

// Get current user
trpc.auth.me.useQuery()
```

---

#### 1.2 Signup Page (`/auth/signup`)

**Purpose**: User registration

**API Endpoints Used**:

```typescript
// Register New User
POST /api/auth/sign-up/email
Request:
{
  "email": "newuser@example.com",
  "password": "securePassword123",
  "name": "Jane Doe" // Optional
}
Response:
{
  "user": {
    "id": "usr_xxx",
    "email": "newuser@example.com",
    "name": "Jane Doe",
    "emailVerified": false,
    "storageQuota": 107374182400, // 100GB in bytes
    "maxBuckets": 10,
    "usedStorage": 0
  },
  "session": { /* session object */ }
}
```

**tRPC Alternative**:

```typescript
trpc.auth.register.mutate({
  email: "newuser@example.com",
  password: "securePassword123",
  name: "Jane Doe"
})
```

**Validations**:
- Email: Valid email format
- Password: Minimum 8 characters
- Name: Optional, max 255 characters

---

#### 1.3 Forgot Password Page (`/auth/forgot-password`)

**Purpose**: Request password reset

**API Endpoints Used**:

```typescript
// Request Password Reset
POST /api/auth/forgot-password
Request:
{
  "email": "user@example.com"
}
Response:
{
  "success": true,
  "message": "Password reset email sent"
}
```

**Email Sent**: Contains reset link with token (valid for 1 hour)

---

#### 1.4 Reset Password Page (`/auth/reset-password`)

**Purpose**: Reset password with token

**API Endpoints Used**:

```typescript
// Reset Password
POST /api/auth/reset-password
Request:
{
  "token": "reset_token_from_email",
  "password": "newPassword123"
}
Response:
{
  "success": true,
  "message": "Password updated successfully"
}
```

**Validations**:
- Token must be valid and not expired
- Password minimum 8 characters

---

### Session Management

#### Get All Active Sessions

```typescript
// List Active Sessions
trpc.auth.getSessions.useQuery()

Response:
[
  {
    "id": "session_xxx",
    "token": "ses_xxx",
    "ipAddress": "192.168.1.1",
    "userAgent": "Mozilla/5.0...",
    "expiresAt": "2025-11-17T00:00:00Z",
    "createdAt": "2025-11-10T00:00:00Z",
    "isCurrent": true
  },
  // ... more sessions
]
```

#### Revoke Specific Session

```typescript
// Revoke Session
trpc.auth.revokeSession.mutate({
  sessionId: "session_xxx"
})
```

#### Revoke All Other Sessions

```typescript
// Revoke All Sessions (except current)
trpc.auth.revokeAllSessions.mutate()
```

#### Logout

```typescript
// Logout Current Session
POST /api/auth/sign-out
Response: { "success": true }

// Or using tRPC
trpc.auth.logout.mutate()
```

---

### Profile Management

#### Update Profile

```typescript
// Update User Profile
trpc.auth.updateProfile.mutate({
  name: "New Name",
  image: "https://example.com/avatar.jpg" // Optional
})

Response:
{
  "id": "usr_xxx",
  "email": "user@example.com",
  "name": "New Name",
  "image": "https://example.com/avatar.jpg"
}
```

#### Change Password

```typescript
// Change Password (requires current password)
trpc.auth.changePassword.mutate({
  currentPassword: "oldPassword123",
  newPassword: "newPassword456"
})

Response: { "success": true }
```

**Security**: Invalidates all other sessions after password change

---

## 2. Dashboard & Analytics

### Page: Dashboard (`/app`)

**Purpose**: Overview of storage, buckets, and activity

**API Endpoints Used**:

#### 2.1 Get Bucket Statistics

```typescript
// Get Bucket Stats
trpc.bucket.getStats.useQuery()

Response:
{
  "totalBuckets": 5,
  "totalObjects": 1234,
  "totalSize": 52428800, // Bytes
  "totalSizeFormatted": "50 MB",
  "storageQuota": 107374182400, // 100GB
  "storageQuotaFormatted": "100 GB",
  "usedPercentage": 0.05,
  "availableStorage": 107321753600,
  "availableStorageFormatted": "99.95 GB"
}
```

#### 2.2 Get Recent Buckets

```typescript
// List Buckets (sorted by recent activity)
trpc.bucket.list.useQuery()

Response:
[
  {
    "id": "bkt_xxx",
    "name": "my-bucket",
    "region": "us-east-1",
    "objectCount": 42,
    "totalSize": 10485760, // 10MB
    "totalSizeFormatted": "10 MB",
    "storageClass": "STANDARD",
    "acl": "private",
    "versioningEnabled": false,
    "createdAt": "2025-11-01T00:00:00Z",
    "updatedAt": "2025-11-10T00:00:00Z"
  },
  // ... more buckets
]
```

#### 2.3 Get User Profile

```typescript
// Get Current User with Quotas
trpc.auth.me.useQuery()

Response:
{
  "id": "usr_xxx",
  "email": "user@example.com",
  "name": "John Doe",
  "isAdmin": false,
  "isActive": true,
  "storageQuota": 107374182400,
  "maxBuckets": 10,
  "usedStorage": 52428800,
  "createdAt": "2025-01-01T00:00:00Z"
}
```

#### 2.4 Get Activity Feed (Future Enhancement)

Currently not implemented. Plan to add audit log queries:

```typescript
// Proposed API
trpc.auditLog.list.useQuery({
  limit: 20,
  offset: 0
})
```

**Dashboard Displays**:
- **Statistics Cards**: Total buckets, storage used, total objects, API requests (from metrics)
- **Recent Buckets**: List of 5 most recently updated buckets
- **Quick Actions**: Create bucket, upload object, manage access keys
- **Activity Feed**: Recent operations (to be implemented)

---

### Page: Analytics (`/app/analytics`)

**Purpose**: Usage metrics and storage trends

**API Endpoints Used**:

#### 2.5 Get Metrics (JSON Format)

```typescript
// Get Application Metrics
GET /api/metrics/json

Response:
{
  "api": {
    "requests_total": 12345,
    "requests_by_endpoint": {
      "/api/trpc/bucket.list": 234,
      "/api/trpc/object.upload": 567,
      // ... more endpoints
    },
    "errors_total": 12,
    "latency_avg": 45.6 // milliseconds
  },
  "storage": {
    "total_buckets": 5,
    "total_objects": 1234,
    "total_size_bytes": 52428800
  },
  "users": {
    "total_users": 10,
    "active_users": 8
  }
}
```

#### 2.6 Get Access Key Statistics

```typescript
// Access Key Stats
trpc.accessKey.getStats.useQuery()

Response:
{
  "total": 5,
  "active": 3,
  "inactive": 2,
  "neverUsed": 1,
  "recentlyUsed": 4
}
```

**Analytics Page Displays**:
- **Storage Trends**: Chart showing storage usage over time
- **API Usage**: Request counts by endpoint
- **Object Operations**: Uploads, downloads, deletes
- **Bandwidth**: Data transfer metrics (to be implemented)
- **Cost Estimation**: Based on storage and transfer (future)

---

## 3. Bucket Management

### Page: Buckets List (`/app/buckets`)

**Purpose**: View and manage all buckets

**API Endpoints Used**:

#### 3.1 List All Buckets

```typescript
// List User Buckets
trpc.bucket.list.useQuery()

Response:
[
  {
    "id": "bkt_xxx",
    "name": "my-photos",
    "region": "us-east-1",
    "storageClass": "STANDARD",
    "acl": "private",
    "versioningEnabled": false,
    "encryptionEnabled": false,
    "websiteEnabled": false,
    "objectCount": 142,
    "totalSize": 524288000,
    "totalSizeFormatted": "500 MB",
    "createdAt": "2025-11-01T00:00:00Z",
    "updatedAt": "2025-11-10T12:30:00Z"
  },
  // ... more buckets
]
```

#### 3.2 Create New Bucket

```typescript
// Create Bucket
trpc.bucket.create.mutate({
  name: "my-new-bucket",
  region: "us-east-1", // Optional, default from config
  storageClass: "STANDARD", // Optional: STANDARD, GLACIER
  acl: "private" // Optional: private, public-read, public-read-write
})

Response:
{
  "id": "bkt_xxx",
  "name": "my-new-bucket",
  "region": "us-east-1",
  "volumePath": "/storage/usr_xxx/my-new-bucket",
  "storageClass": "STANDARD",
  "acl": "private",
  "versioningEnabled": false,
  "createdAt": "2025-11-10T13:00:00Z"
}
```

**Validations**:
- **Name**: 3-63 characters, lowercase, numbers, hyphens
- **Must start/end with letter or number**
- **No consecutive hyphens**
- **Must be globally unique** (within the platform)
- **Max buckets**: Check quota (default 10 per user)

**Errors**:
- `BUCKET_ALREADY_EXISTS`: Bucket name taken
- `INVALID_BUCKET_NAME`: Name doesn't meet requirements
- `BUCKET_QUOTA_EXCEEDED`: User has reached max buckets

#### 3.3 Check Bucket Name Availability

```typescript
// Check if Bucket Name is Available
trpc.bucket.checkAvailability.useQuery({
  name: "desired-bucket-name"
})

Response:
{
  "available": true,
  "name": "desired-bucket-name"
}
// OR
{
  "available": false,
  "name": "existing-bucket",
  "reason": "Bucket name already exists"
}
```

#### 3.4 Delete Bucket

```typescript
// Delete Empty Bucket
trpc.bucket.delete.mutate({
  name: "my-old-bucket"
})

// Force Delete (deletes all objects)
trpc.bucket.delete.mutate({
  name: "my-old-bucket",
  force: true
})

Response: { "success": true }
```

**Validations**:
- Bucket must be empty (unless `force: true`)
- User must own the bucket

**Errors**:
- `BUCKET_NOT_EMPTY`: Bucket contains objects (use force or delete objects first)
- `BUCKET_NOT_FOUND`: Bucket doesn't exist

---

### Page: Bucket Details (`/app/buckets/[name]`)

**Purpose**: View bucket contents and manage objects

**API Endpoints Used**:

#### 3.5 Get Bucket Details

```typescript
// Get Specific Bucket
trpc.bucket.get.useQuery({
  name: "my-bucket"
})

Response:
{
  "id": "bkt_xxx",
  "name": "my-bucket",
  "region": "us-east-1",
  "volumePath": "/storage/usr_xxx/my-bucket",
  "storageClass": "STANDARD",
  "acl": "private",
  "versioningEnabled": true,
  "mfaDelete": false,
  "encryptionEnabled": false,
  "websiteEnabled": false,
  "indexDocument": null,
  "errorDocument": null,
  "lifecycleRules": null,
  "policy": null,
  "corsRules": null,
  "objectCount": 42,
  "totalSize": 10485760,
  "totalSizeFormatted": "10 MB",
  "createdAt": "2025-11-01T00:00:00Z",
  "updatedAt": "2025-11-10T13:30:00Z",
  "user": {
    "id": "usr_xxx",
    "email": "user@example.com",
    "name": "John Doe"
  }
}
```

#### 3.6 Update Bucket Configuration

```typescript
// Update Bucket Settings
trpc.bucket.updateConfig.mutate({
  name: "my-bucket",
  acl: "public-read", // Optional
  versioningEnabled: true, // Optional
  websiteEnabled: true, // Optional
  indexDocument: "index.html", // Optional (requires websiteEnabled)
  errorDocument: "error.html" // Optional (requires websiteEnabled)
})

Response:
{
  "id": "bkt_xxx",
  "name": "my-bucket",
  "acl": "public-read",
  "versioningEnabled": true,
  "websiteEnabled": true,
  "indexDocument": "index.html",
  "errorDocument": "error.html"
}
```

**Website Hosting**:
- When enabled, bucket serves static website
- `indexDocument`: Default file (e.g., "index.html")
- `errorDocument`: Error page (e.g., "404.html")

---

## 4. Object Operations

### Page: Bucket Objects (`/app/buckets/[name]`)

**Purpose**: Browse and manage objects in a bucket

**API Endpoints Used**:

#### 4.1 List Objects in Bucket

```typescript
// List Objects
trpc.object.list.useQuery({
  bucketName: "my-bucket",
  prefix: "photos/", // Optional: filter by prefix
  delimiter: "/", // Optional: folder simulation
  maxKeys: 100, // Optional: default 1000
  startAfter: "photos/image-050.jpg" // Optional: pagination
})

Response:
{
  "objects": [
    {
      "id": "obj_xxx",
      "key": "photos/vacation/beach.jpg",
      "versionId": "ver_xxx",
      "isLatest": true,
      "size": 2048576, // 2MB
      "sizeFormatted": "2 MB",
      "contentType": "image/jpeg",
      "etag": "d41d8cd98f00b204e9800998ecf8427e",
      "storageClass": "STANDARD",
      "lastModified": "2025-11-10T10:30:00Z",
      "metadata": {
        "camera": "Canon EOS",
        "location": "Hawaii"
      }
    },
    // ... more objects
  ],
  "commonPrefixes": [
    "photos/vacation/",
    "photos/family/"
  ],
  "isTruncated": false,
  "nextMarker": null,
  "maxKeys": 100
}
```

**Pagination**:
- Use `startAfter` with last object key from previous page
- `isTruncated: true` means more results available

**Folder Simulation**:
- Use `delimiter: "/"` to group objects by prefix
- `commonPrefixes` shows "folders"
- Filter by `prefix` to browse into a folder

#### 4.2 Upload Object

```typescript
// Upload Single Object
trpc.object.upload.mutate({
  bucketName: "my-bucket",
  key: "documents/report.pdf",
  filePath: "/tmp/upload-xxx", // Server-side temp file path
  contentType: "application/pdf", // Optional
  metadata: { // Optional custom metadata
    "author": "John Doe",
    "department": "Engineering"
  },
  storageClass: "STANDARD" // Optional
})

Response:
{
  "id": "obj_xxx",
  "bucketId": "bkt_xxx",
  "key": "documents/report.pdf",
  "versionId": "ver_xxx",
  "size": 1048576,
  "contentType": "application/pdf",
  "etag": "098f6bcd4621d373cade4e832627b4f6",
  "storageClass": "STANDARD",
  "metadata": {
    "author": "John Doe",
    "department": "Engineering"
  },
  "physicalPath": "/storage/usr_xxx/my-bucket/documents/report.pdf",
  "createdAt": "2025-11-10T14:00:00Z"
}
```

**Quota Check**: Automatically validates user storage quota before upload

**For Frontend Upload Flow**:
1. User selects file in browser
2. Frontend uploads file to temporary endpoint
3. Frontend calls `object.upload` with temp file path
4. Backend moves file to permanent storage

#### 4.3 Get Object Metadata

```typescript
// Get Object Details
trpc.object.getMetadata.useQuery({
  bucketName: "my-bucket",
  key: "documents/report.pdf",
  versionId: "ver_xxx" // Optional: specific version
})

Response:
{
  "id": "obj_xxx",
  "key": "documents/report.pdf",
  "versionId": "ver_xxx",
  "isLatest": true,
  "size": 1048576,
  "sizeFormatted": "1 MB",
  "contentType": "application/pdf",
  "etag": "098f6bcd4621d373cade4e832627b4f6",
  "md5Hash": "098f6bcd4621d373cade4e832627b4f6",
  "storageClass": "STANDARD",
  "metadata": {
    "author": "John Doe",
    "department": "Engineering"
  },
  "lastModified": "2025-11-10T14:00:00Z",
  "createdAt": "2025-11-10T14:00:00Z"
}
```

#### 4.4 Download Object

**Option 1: Direct Download via S3 API**

```typescript
// Download via S3 API (requires authentication)
GET /api/s3/my-bucket/documents/report.pdf
Headers:
  Authorization: AWS4-HMAC-SHA256 ...

Response: Binary file content
Headers:
  Content-Type: application/pdf
  Content-Length: 1048576
  ETag: "098f6bcd4621d373cade4e832627b4f6"
  Last-Modified: Wed, 10 Nov 2025 14:00:00 GMT
  x-amz-meta-author: John Doe
  x-amz-meta-department: Engineering
```

**Option 2: Presigned URL (recommended for frontend)**

```typescript
// Generate presigned download URL
trpc.presignedUrl.generateGetUrl.mutate({
  bucketName: "my-bucket",
  key: "documents/report.pdf",
  expiresIn: 3600 // 1 hour (in seconds, max 604800 = 7 days)
})

Response:
{
  "id": "psu_xxx",
  "url": "https://v2bucket.discus-likert.ts.net/api/s3/my-bucket/documents/report.pdf?signature=xxx&expires=xxx",
  "operation": "GET",
  "expiresAt": "2025-11-10T15:00:00Z",
  "createdAt": "2025-11-10T14:00:00Z"
}

// Then download in browser
fetch(url).then(response => response.blob())
```

#### 4.5 Delete Object

```typescript
// Delete Object
trpc.object.delete.mutate({
  bucketName: "my-bucket",
  key: "documents/old-file.pdf",
  versionId: "ver_xxx" // Optional: delete specific version
})

Response: { "success": true }
```

**Versioning Behavior**:
- **Versioning Disabled**: Permanent deletion
- **Versioning Enabled**: Creates delete marker (soft delete)
- **Specific Version**: Permanently deletes that version

#### 4.6 Copy Object

```typescript
// Copy Object (same or different bucket)
trpc.object.copy.mutate({
  sourceBucket: "my-bucket",
  sourceKey: "photos/original.jpg",
  destBucket: "backup-bucket",
  destKey: "photos/copy.jpg",
  metadata: { // Optional: override metadata
    "backup-date": "2025-11-10"
  }
})

Response:
{
  "id": "obj_yyy",
  "bucketId": "bkt_yyy",
  "key": "photos/copy.jpg",
  "size": 2048576,
  "contentType": "image/jpeg",
  "etag": "d41d8cd98f00b204e9800998ecf8427e",
  "createdAt": "2025-11-10T14:30:00Z"
}
```

**Validations**:
- Source object must exist
- User must have access to both buckets
- Destination bucket must have space quota

#### 4.7 Update Object Metadata

```typescript
// Update Object Metadata (without re-uploading)
trpc.object.updateMetadata.mutate({
  bucketName: "my-bucket",
  key: "documents/report.pdf",
  contentType: "application/pdf", // Optional
  metadata: { // Optional: replaces all metadata
    "author": "Jane Doe",
    "version": "2.0"
  },
  storageClass: "GLACIER" // Optional: change storage class
})

Response:
{
  "id": "obj_xxx",
  "key": "documents/report.pdf",
  "contentType": "application/pdf",
  "metadata": {
    "author": "Jane Doe",
    "version": "2.0"
  },
  "storageClass": "GLACIER",
  "updatedAt": "2025-11-10T14:45:00Z"
}
```

#### 4.8 Get Object Statistics

```typescript
// Get Statistics for Objects in Bucket
trpc.object.getStats.useQuery({
  bucketName: "my-bucket"
})

Response:
{
  "totalObjects": 42,
  "totalSize": 104857600,
  "totalSizeFormatted": "100 MB",
  "byStorageClass": {
    "STANDARD": {
      "count": 30,
      "size": 83886080
    },
    "GLACIER": {
      "count": 12,
      "size": 20971520
    }
  },
  "byContentType": {
    "image/jpeg": {
      "count": 20,
      "size": 41943040
    },
    "application/pdf": {
      "count": 15,
      "size": 52428800
    },
    "video/mp4": {
      "count": 7,
      "size": 10485760
    }
  }
}
```

---

## 5. Access Keys Management

### Page: Access Keys (`/app/access-keys`)

**Purpose**: Manage AWS-style access keys for S3 API

**API Endpoints Used**:

#### 5.1 List Access Keys

```typescript
// List All Access Keys
trpc.accessKey.list.useQuery({
  includeInactive: true // Optional: default false
})

Response:
[
  {
    "id": "ak_xxx",
    "accessKeyId": "AKIA6ODH3PMXXXXXXXX",
    "name": "Production API Key",
    "isActive": true,
    "lastUsedAt": "2025-11-10T12:00:00Z",
    "expiresAt": null,
    "createdAt": "2025-11-01T00:00:00Z"
  },
  {
    "id": "ak_yyy",
    "accessKeyId": "AKIA6ODH3PMYYYYYYYY",
    "name": "Development",
    "isActive": false,
    "lastUsedAt": null,
    "expiresAt": "2025-12-01T00:00:00Z",
    "createdAt": "2025-10-15T00:00:00Z"
  }
]
```

**Note**: Secret key is **never** returned after creation

#### 5.2 Create Access Key

```typescript
// Create New Access Key
trpc.accessKey.create.mutate({
  name: "My Application Key", // Optional
  expiresAt: "2026-11-10T00:00:00Z" // Optional: expiration date
})

Response:
{
  "id": "ak_xxx",
  "accessKeyId": "AKIA6ODH3PMZZZZZZZZ",
  "secretAccessKey": "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY", // ONLY SHOWN ONCE!
  "name": "My Application Key",
  "isActive": true,
  "expiresAt": "2026-11-10T00:00:00Z",
  "createdAt": "2025-11-10T15:00:00Z"
}
```

**IMPORTANT**:
- **Secret key is only shown ONCE** at creation
- Store it securely immediately
- Cannot be retrieved later
- Max 10 access keys per user

**Errors**:
- `ACCESS_KEY_QUOTA_EXCEEDED`: User has reached max keys (10)

#### 5.3 Get Specific Access Key

```typescript
// Get Access Key Details (without secret)
trpc.accessKey.get.useQuery({
  id: "ak_xxx"
})

Response:
{
  "id": "ak_xxx",
  "accessKeyId": "AKIA6ODH3PMZZZZZZZZ",
  "name": "My Application Key",
  "isActive": true,
  "lastUsedAt": "2025-11-10T12:00:00Z",
  "expiresAt": "2026-11-10T00:00:00Z",
  "createdAt": "2025-11-10T15:00:00Z"
}
```

#### 5.4 Update Access Key

```typescript
// Update Access Key Name
trpc.accessKey.update.mutate({
  id: "ak_xxx",
  name: "Renamed Key"
})

Response:
{
  "id": "ak_xxx",
  "name": "Renamed Key"
}
```

#### 5.5 Activate/Deactivate Access Key

```typescript
// Deactivate Key (disable without deleting)
trpc.accessKey.deactivate.mutate({
  id: "ak_xxx"
})

// Activate Key
trpc.accessKey.activate.mutate({
  id: "ak_xxx"
})

Response: { "success": true }
```

**Use Case**: Temporarily disable a key without deleting it

#### 5.6 Delete Access Key

```typescript
// Permanently Delete Access Key
trpc.accessKey.delete.mutate({
  id: "ak_xxx"
})

Response: { "success": true }
```

**Warning**: Deletion is permanent and will break applications using this key

#### 5.7 Get Access Key Statistics

```typescript
// Get Statistics
trpc.accessKey.getStats.useQuery()

Response:
{
  "total": 5,
  "active": 3,
  "inactive": 2,
  "neverUsed": 1,
  "recentlyUsed": 4
}
```

---

## 6. Presigned URLs

### Purpose
Presigned URLs allow temporary, secure access to objects without requiring AWS credentials. Perfect for:
- Sharing files with external users
- Direct browser uploads
- Time-limited downloads

**API Endpoints**:

#### 6.1 Generate Download URL (GET)

```typescript
// Generate Presigned GET URL
trpc.presignedUrl.generateGetUrl.mutate({
  bucketName: "my-bucket",
  key: "documents/report.pdf",
  expiresIn: 3600 // Seconds (1 hour), max 604800 (7 days)
})

Response:
{
  "id": "psu_xxx",
  "url": "https://v2bucket.discus-likert.ts.net/api/s3/my-bucket/documents/report.pdf?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=...&X-Amz-Signature=...",
  "bucketName": "my-bucket",
  "objectKey": "documents/report.pdf",
  "operation": "GET",
  "expiresAt": "2025-11-10T16:00:00Z",
  "isRevoked": false,
  "createdAt": "2025-11-10T15:00:00Z"
}
```

**Usage**:
```html
<!-- Direct download link -->
<a href="{url}" download>Download Report</a>

<!-- Or in JavaScript -->
<script>
fetch(url)
  .then(response => response.blob())
  .then(blob => {
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'report.pdf';
    a.click();
  });
</script>
```

#### 6.2 Generate Upload URL (PUT)

```typescript
// Generate Presigned PUT URL
trpc.presignedUrl.generatePutUrl.mutate({
  bucketName: "my-bucket",
  key: "uploads/user-photo.jpg",
  expiresIn: 3600, // 1 hour
  contentType: "image/jpeg" // Optional but recommended
})

Response:
{
  "id": "psu_yyy",
  "url": "https://v2bucket.discus-likert.ts.net/api/s3/my-bucket/uploads/user-photo.jpg?X-Amz-Algorithm=...",
  "bucketName": "my-bucket",
  "objectKey": "uploads/user-photo.jpg",
  "operation": "PUT",
  "expiresAt": "2025-11-10T16:00:00Z",
  "createdAt": "2025-11-10T15:00:00Z"
}
```

**Usage (Browser Upload)**:
```javascript
// Upload file directly from browser
const file = document.getElementById('fileInput').files[0];

fetch(presignedUrl, {
  method: 'PUT',
  body: file,
  headers: {
    'Content-Type': 'image/jpeg'
  }
})
.then(response => {
  if (response.ok) {
    console.log('Upload successful!');
  }
});
```

#### 6.3 Generate Delete URL (DELETE)

```typescript
// Generate Presigned DELETE URL
trpc.presignedUrl.generateDeleteUrl.mutate({
  bucketName: "my-bucket",
  key: "temp/old-file.txt",
  expiresIn: 1800 // 30 minutes
})

Response:
{
  "id": "psu_zzz",
  "url": "https://v2bucket.discus-likert.ts.net/api/s3/my-bucket/temp/old-file.txt?X-Amz-Algorithm=...",
  "operation": "DELETE",
  "expiresAt": "2025-11-10T15:30:00Z"
}
```

#### 6.4 List Presigned URLs

```typescript
// List All Presigned URLs
trpc.presignedUrl.list.useQuery({
  bucketName: "my-bucket", // Optional: filter by bucket
  includeExpired: false, // Optional: default false
  maxUrls: 100 // Optional: default 100
})

Response:
[
  {
    "id": "psu_xxx",
    "bucketName": "my-bucket",
    "objectKey": "documents/report.pdf",
    "operation": "GET",
    "expiresAt": "2025-11-10T16:00:00Z",
    "isRevoked": false,
    "usedCount": 5,
    "lastUsedAt": "2025-11-10T15:30:00Z",
    "createdAt": "2025-11-10T15:00:00Z"
  },
  // ... more URLs
]
```

#### 6.5 Revoke Presigned URL

```typescript
// Revoke URL Before Expiration
trpc.presignedUrl.revoke.mutate({
  id: "psu_xxx"
})

Response: { "success": true }
```

**Use Case**: Immediately invalidate a shared link

#### 6.6 Get Presigned URL Statistics

```typescript
// Get Statistics
trpc.presignedUrl.getStats.useQuery({
  bucketName: "my-bucket" // Optional
})

Response:
{
  "total": 25,
  "active": 10,
  "expired": 12,
  "revoked": 3,
  "byOperation": {
    "GET": 15,
    "PUT": 8,
    "DELETE": 2
  },
  "totalUsage": 142
}
```

---

## 7. Bucket Policies & CORS

### Purpose
Control access to buckets and enable cross-origin requests

**API Endpoints**:

#### 7.1 Get Bucket Policy

```typescript
// Get Current Bucket Policy
trpc.bucketPolicy.getPolicy.useQuery({
  bucketName: "my-bucket"
})

Response:
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicReadGetObject",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::my-bucket/*"
    }
  ]
}
```

#### 7.2 Set Custom Bucket Policy

```typescript
// Set Bucket Policy (AWS S3 JSON format)
trpc.bucketPolicy.setPolicy.mutate({
  bucketName: "my-bucket",
  policy: {
    "Version": "2012-10-17",
    "Statement": [
      {
        "Sid": "PublicReadGetObject",
        "Effect": "Allow",
        "Principal": "*",
        "Action": ["s3:GetObject"],
        "Resource": "arn:aws:s3:::my-bucket/public/*"
      }
    ]
  }
})

Response: { "success": true }
```

**Common Policy Examples**:

**Public Read for All Objects**:
```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": "*",
    "Action": "s3:GetObject",
    "Resource": "arn:aws:s3:::my-bucket/*"
  }]
}
```

**Public Read for Specific Folder**:
```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": "*",
    "Action": "s3:GetObject",
    "Resource": "arn:aws:s3:::my-bucket/public/*"
  }]
}
```

#### 7.3 Set Predefined Policies

```typescript
// Set Private Policy (default)
trpc.bucketPolicy.setPrivatePolicy.mutate({
  bucketName: "my-bucket"
})

// Set Public Read Policy
trpc.bucketPolicy.setPublicReadPolicy.mutate({
  bucketName: "my-bucket"
})

Response: { "success": true }
```

#### 7.4 Delete Bucket Policy

```typescript
// Remove Policy (revert to private)
trpc.bucketPolicy.deletePolicy.mutate({
  bucketName: "my-bucket"
})

Response: { "success": true }
```

---

### CORS Configuration

#### 7.5 Get CORS Configuration

```typescript
// Get Current CORS Rules
trpc.bucketPolicy.getCORS.useQuery({
  bucketName: "my-bucket"
})

Response:
{
  "CORSRules": [
    {
      "AllowedOrigins": ["https://example.com"],
      "AllowedMethods": ["GET", "PUT", "POST"],
      "AllowedHeaders": ["*"],
      "ExposeHeaders": ["ETag", "x-amz-meta-custom"],
      "MaxAgeSeconds": 3600
    }
  ]
}
```

#### 7.6 Set CORS Configuration

```typescript
// Set CORS Rules
trpc.bucketPolicy.setCORS.mutate({
  bucketName: "my-bucket",
  cors: {
    "CORSRules": [
      {
        "AllowedOrigins": ["https://app.example.com", "https://example.com"],
        "AllowedMethods": ["GET", "PUT", "POST", "DELETE"],
        "AllowedHeaders": ["*"],
        "ExposeHeaders": ["ETag"],
        "MaxAgeSeconds": 3600
      }
    ]
  }
})

Response: { "success": true }
```

**CORS Rule Properties**:
- **AllowedOrigins**: Array of allowed domains (use "*" for all)
- **AllowedMethods**: HTTP methods (GET, PUT, POST, DELETE, HEAD)
- **AllowedHeaders**: Request headers (use "*" for all)
- **ExposeHeaders**: Response headers to expose to browser
- **MaxAgeSeconds**: Preflight cache duration (seconds)

#### 7.7 Set Default CORS (Allow All)

```typescript
// Set Permissive CORS
trpc.bucketPolicy.setDefaultCORS.mutate({
  bucketName: "my-bucket"
})

Response: { "success": true }
```

**Default CORS**:
```json
{
  "CORSRules": [{
    "AllowedOrigins": ["*"],
    "AllowedMethods": ["GET", "PUT", "POST", "DELETE", "HEAD"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }]
}
```

#### 7.8 Delete CORS Configuration

```typescript
// Remove CORS Rules
trpc.bucketPolicy.deleteCORS.mutate({
  bucketName: "my-bucket"
})

Response: { "success": true }
```

#### 7.9 Get Policy & CORS Status

```typescript
// Get Combined Status
trpc.bucketPolicy.getStatus.useQuery({
  bucketName: "my-bucket"
})

Response:
{
  "hasPolicy": true,
  "hasCORS": true,
  "isPublic": true,
  "corsEnabled": true,
  "lastUpdated": "2025-11-10T15:00:00Z"
}
```

---

## 8. Multipart Upload

### Purpose
Upload large files (>5MB) in parts for better reliability and performance

**Use Cases**:
- Large files (>100MB)
- Unreliable network connections
- Parallel uploads
- Resume capability

**API Endpoints**:

#### 8.1 Initiate Multipart Upload

```typescript
// Start Multipart Upload
trpc.multipart.initiate.mutate({
  bucketName: "my-bucket",
  key: "videos/large-video.mp4",
  contentType: "video/mp4", // Optional
  metadata: { // Optional
    "title": "My Video",
    "duration": "3600"
  },
  storageClass: "STANDARD" // Optional
})

Response:
{
  "id": "mpu_xxx",
  "uploadId": "VXBsb2FkIElEIGZvciA2aWWpbmcncyBteS1tb3ZpZS5tMnRzIHVwbG9hZA",
  "bucketName": "my-bucket",
  "key": "videos/large-video.mp4",
  "initiatedAt": "2025-11-10T15:00:00Z"
}
```

**Save the `uploadId`** - you'll need it for all subsequent operations

#### 8.2 Upload Part

```typescript
// Upload Individual Part
trpc.multipart.uploadPart.mutate({
  bucketName: "my-bucket",
  key: "videos/large-video.mp4",
  uploadId: "VXBsb2FkIElEIGZvciA2aWWpbmcncyBteS1tb3ZpZS5tMnRzIHVwbG9hZA",
  partNumber: 1, // 1 to 10,000
  filePath: "/tmp/upload-part-1" // Server-side temp file
})

Response:
{
  "id": "part_xxx",
  "partNumber": 1,
  "etag": "5d41402abc4b2a76b9719d911017c592",
  "size": 5242880, // 5MB
  "uploadedAt": "2025-11-10T15:05:00Z"
}
```

**Important**:
- **Part Numbers**: 1 to 10,000 (sequential)
- **Minimum Size**: 5MB per part (except last part)
- **Maximum Size**: 5GB per part
- **Save ETags**: Required for completion

**Typical Upload Flow**:
```typescript
// 1. Split file into chunks (e.g., 5MB each)
const chunkSize = 5 * 1024 * 1024; // 5MB
const chunks = Math.ceil(file.size / chunkSize);

// 2. Upload each chunk
const parts = [];
for (let i = 0; i < chunks; i++) {
  const partNumber = i + 1;
  const start = i * chunkSize;
  const end = Math.min(start + chunkSize, file.size);
  const chunk = file.slice(start, end);

  // Upload to temp endpoint, get filePath
  const tempPath = await uploadToTemp(chunk);

  // Upload part
  const part = await trpc.multipart.uploadPart.mutate({
    bucketName,
    key,
    uploadId,
    partNumber,
    filePath: tempPath
  });

  parts.push({
    partNumber: part.partNumber,
    etag: part.etag
  });
}
```

#### 8.3 List Uploaded Parts

```typescript
// List Parts Already Uploaded
trpc.multipart.listParts.useQuery({
  bucketName: "my-bucket",
  key: "videos/large-video.mp4",
  uploadId: "VXBsb2FkIElEIGZvciA2aWWpbmcncyBteS1tb3ZpZS5tMnRzIHVwbG9hZA",
  maxParts: 100, // Optional: default 100
  partNumberMarker: 0 // Optional: pagination
})

Response:
{
  "parts": [
    {
      "partNumber": 1,
      "etag": "5d41402abc4b2a76b9719d911017c592",
      "size": 5242880,
      "uploadedAt": "2025-11-10T15:05:00Z"
    },
    {
      "partNumber": 2,
      "etag": "7d793037a0760186574b0282f2f435e7",
      "size": 5242880,
      "uploadedAt": "2025-11-10T15:06:00Z"
    }
  ],
  "isTruncated": false,
  "maxParts": 100,
  "nextPartNumberMarker": null
}
```

**Use Case**: Resume interrupted upload by checking which parts are already uploaded

#### 8.4 Complete Multipart Upload

```typescript
// Finalize Upload (combine parts)
trpc.multipart.complete.mutate({
  bucketName: "my-bucket",
  key: "videos/large-video.mp4",
  uploadId: "VXBsb2FkIElEIGZvciA2aWWpbmcncyBteS1tb3ZpZS5tMnRzIHVwbG9hZA",
  parts: [
    { partNumber: 1, etag: "5d41402abc4b2a76b9719d911017c592" },
    { partNumber: 2, etag: "7d793037a0760186574b0282f2f435e7" },
    { partNumber: 3, etag: "98f13708210194c475687be6106a3b84" }
  ]
})

Response:
{
  "id": "obj_xxx",
  "bucketId": "bkt_xxx",
  "key": "videos/large-video.mp4",
  "size": 15728640, // Combined size
  "etag": "3858f62230ac3c915f300c664312c11f-3", // Note: -3 indicates 3 parts
  "contentType": "video/mp4",
  "completedAt": "2025-11-10T15:10:00Z"
}
```

**Validations**:
- All parts must exist
- ETags must match uploaded parts
- Parts must be in sequential order (1, 2, 3...)

#### 8.5 Abort Multipart Upload

```typescript
// Cancel Upload and Clean Up
trpc.multipart.abort.mutate({
  bucketName: "my-bucket",
  key: "videos/large-video.mp4",
  uploadId: "VXBsb2FkIElEIGZvciA2aWWpbmcncyBteS1tb3ZpZS5tMnRzIHVwbG9hZA"
})

Response: { "success": true }
```

**Effect**: Deletes all uploaded parts and cancels the upload

#### 8.6 List Multipart Uploads

```typescript
// List In-Progress Uploads
trpc.multipart.listUploads.useQuery({
  bucketName: "my-bucket", // Optional: filter by bucket
  maxUploads: 100 // Optional: default 100
})

Response:
[
  {
    "id": "mpu_xxx",
    "uploadId": "VXBsb2FkIElEIGZvciA2aWWpbmcncyBteS1tb3ZpZS5tMnRzIHVwbG9hZA",
    "bucketName": "my-bucket",
    "key": "videos/large-video.mp4",
    "status": "in-progress",
    "initiatedAt": "2025-11-10T15:00:00Z",
    "partsUploaded": 2,
    "totalSize": 10485760
  },
  // ... more uploads
]
```

**Use Cases**:
- Monitor in-progress uploads
- Find and abort stuck uploads
- Resume interrupted uploads

---

## 9. User Management

### Page: Users (`/app/users`)

**Purpose**: Admin-only page for managing users

**Access Control**: Only users with `isAdmin: true` can access

**API Endpoints** (Future Implementation):

Currently, user management is done through database directly. Planned API endpoints:

```typescript
// List All Users (Admin only)
trpc.user.list.useQuery({
  isActive: true, // Optional: filter by status
  limit: 50,
  offset: 0
})

// Get Specific User (Admin only)
trpc.user.get.useQuery({
  userId: "usr_xxx"
})

// Update User (Admin only)
trpc.user.update.mutate({
  userId: "usr_xxx",
  isActive: false, // Disable account
  storageQuota: 214748364800, // 200GB
  maxBuckets: 20
})

// Delete User (Admin only)
trpc.user.delete.mutate({
  userId: "usr_xxx",
  deleteData: true // Also delete buckets and objects
})
```

**User Properties**:
- **isActive**: Enable/disable account
- **isAdmin**: Grant admin privileges
- **storageQuota**: Storage limit (bytes)
- **maxBuckets**: Maximum number of buckets
- **usedStorage**: Current usage (read-only)

---

## 10. S3-Compatible API

### Purpose
AWS S3-compatible API for programmatic access using AWS SDKs

**Authentication**: AWS Signature Version 4 (requires Access Key + Secret Key)

**Base URL**: `https://v2bucket.discus-likert.ts.net/api/s3`

### AWS SDK Configuration

**JavaScript/Node.js (AWS SDK v3)**:
```javascript
import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";

const s3Client = new S3Client({
  region: "us-east-1", // Any region
  endpoint: "https://v2bucket.discus-likert.ts.net/api/s3",
  credentials: {
    accessKeyId: "AKIA6ODH3PMXXXXXXXX",
    secretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"
  },
  forcePathStyle: true // Important for compatibility
});
```

**Python (boto3)**:
```python
import boto3

s3_client = boto3.client(
    's3',
    endpoint_url='https://v2bucket.discus-likert.ts.net/api/s3',
    aws_access_key_id='AKIA6ODH3PMXXXXXXXX',
    aws_secret_access_key='wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
    region_name='us-east-1'
)
```

---

### S3 API Operations

#### 10.1 List Buckets

```bash
# AWS CLI
aws s3 ls \
  --endpoint-url https://v2bucket.discus-likert.ts.net/api/s3

# Response
2025-11-01 10:00:00 my-bucket
2025-11-05 14:30:00 photos-bucket
```

**API Call**:
```
GET /api/s3/
```

**Response (XML)**:
```xml
<?xml version="1.0" encoding="UTF-8"?>
<ListAllMyBucketsResult>
  <Owner>
    <ID>usr_xxx</ID>
    <DisplayName>user@example.com</DisplayName>
  </Owner>
  <Buckets>
    <Bucket>
      <Name>my-bucket</Name>
      <CreationDate>2025-11-01T10:00:00Z</CreationDate>
    </Bucket>
    <Bucket>
      <Name>photos-bucket</Name>
      <CreationDate>2025-11-05T14:30:00Z</CreationDate>
    </Bucket>
  </Buckets>
</ListAllMyBucketsResult>
```

#### 10.2 Create Bucket

```bash
# AWS CLI
aws s3 mb s3://new-bucket \
  --endpoint-url https://v2bucket.discus-likert.ts.net/api/s3
```

**API Call**:
```
PUT /api/s3/new-bucket
```

**Response**: 200 OK

#### 10.3 Delete Bucket

```bash
# AWS CLI
aws s3 rb s3://old-bucket \
  --endpoint-url https://v2bucket.discus-likert.ts.net/api/s3
```

**API Call**:
```
DELETE /api/s3/old-bucket
```

**Response**: 204 No Content

#### 10.4 List Objects

```bash
# AWS CLI
aws s3 ls s3://my-bucket/photos/ \
  --endpoint-url https://v2bucket.discus-likert.ts.net/api/s3
```

**API Call**:
```
GET /api/s3/my-bucket?prefix=photos/&delimiter=/&max-keys=100
```

**Response (XML)**:
```xml
<?xml version="1.0" encoding="UTF-8"?>
<ListBucketResult>
  <Name>my-bucket</Name>
  <Prefix>photos/</Prefix>
  <MaxKeys>100</MaxKeys>
  <IsTruncated>false</IsTruncated>
  <Contents>
    <Key>photos/beach.jpg</Key>
    <Size>2048576</Size>
    <ETag>"d41d8cd98f00b204e9800998ecf8427e"</ETag>
    <LastModified>2025-11-10T10:30:00Z</LastModified>
    <StorageClass>STANDARD</StorageClass>
  </Contents>
</ListBucketResult>
```

#### 10.5 Upload Object

```bash
# AWS CLI
aws s3 cp local-file.jpg s3://my-bucket/photos/file.jpg \
  --endpoint-url https://v2bucket.discus-likert.ts.net/api/s3 \
  --metadata author="John Doe",department="Engineering"
```

**API Call**:
```
PUT /api/s3/my-bucket/photos/file.jpg
Headers:
  Content-Type: image/jpeg
  Content-Length: 2048576
  x-amz-meta-author: John Doe
  x-amz-meta-department: Engineering
Body: [binary file content]
```

**Response**:
```
200 OK
ETag: "d41d8cd98f00b204e9800998ecf8427e"
```

**JavaScript Example**:
```javascript
const putCommand = new PutObjectCommand({
  Bucket: "my-bucket",
  Key: "photos/file.jpg",
  Body: fileBuffer,
  ContentType: "image/jpeg",
  Metadata: {
    author: "John Doe",
    department: "Engineering"
  }
});

await s3Client.send(putCommand);
```

#### 10.6 Download Object

```bash
# AWS CLI
aws s3 cp s3://my-bucket/photos/file.jpg local-file.jpg \
  --endpoint-url https://v2bucket.discus-likert.ts.net/api/s3
```

**API Call**:
```
GET /api/s3/my-bucket/photos/file.jpg
```

**Response**:
```
200 OK
Content-Type: image/jpeg
Content-Length: 2048576
ETag: "d41d8cd98f00b204e9800998ecf8427e"
Last-Modified: Wed, 10 Nov 2025 10:30:00 GMT
x-amz-meta-author: John Doe
x-amz-meta-department: Engineering

[binary file content]
```

**JavaScript Example**:
```javascript
const getCommand = new GetObjectCommand({
  Bucket: "my-bucket",
  Key: "photos/file.jpg"
});

const response = await s3Client.send(getCommand);
const fileBuffer = await streamToBuffer(response.Body);
```

#### 10.7 Delete Object

```bash
# AWS CLI
aws s3 rm s3://my-bucket/photos/old-file.jpg \
  --endpoint-url https://v2bucket.discus-likert.ts.net/api/s3
```

**API Call**:
```
DELETE /api/s3/my-bucket/photos/old-file.jpg
```

**Response**: 204 No Content

#### 10.8 Copy Object

```bash
# AWS CLI
aws s3 cp s3://my-bucket/photo.jpg s3://backup-bucket/photo.jpg \
  --endpoint-url https://v2bucket.discus-likert.ts.net/api/s3
```

**API Call**:
```
PUT /api/s3/backup-bucket/photo.jpg
Headers:
  x-amz-copy-source: /my-bucket/photo.jpg
```

**Response**:
```xml
<?xml version="1.0" encoding="UTF-8"?>
<CopyObjectResult>
  <ETag>"d41d8cd98f00b204e9800998ecf8427e"</ETag>
  <LastModified>2025-11-10T15:00:00Z</LastModified>
</CopyObjectResult>
```

#### 10.9 Get Object Metadata (HEAD)

```bash
# AWS CLI
aws s3api head-object \
  --bucket my-bucket \
  --key photos/file.jpg \
  --endpoint-url https://v2bucket.discus-likert.ts.net/api/s3
```

**API Call**:
```
HEAD /api/s3/my-bucket/photos/file.jpg
```

**Response**:
```
200 OK
Content-Type: image/jpeg
Content-Length: 2048576
ETag: "d41d8cd98f00b204e9800998ecf8427e"
Last-Modified: Wed, 10 Nov 2025 10:30:00 GMT
x-amz-meta-author: John Doe
```

---

### Multipart Upload via S3 API

#### Step 1: Initiate

```bash
aws s3api create-multipart-upload \
  --bucket my-bucket \
  --key videos/large.mp4 \
  --endpoint-url https://v2bucket.discus-likert.ts.net/api/s3
```

**Response**:
```json
{
  "Bucket": "my-bucket",
  "Key": "videos/large.mp4",
  "UploadId": "VXBsb2FkIElEIGZvciA2aWWpbmcncyBteS1tb3ZpZS5tMnRzIHVwbG9hZA"
}
```

#### Step 2: Upload Parts

```bash
aws s3api upload-part \
  --bucket my-bucket \
  --key videos/large.mp4 \
  --part-number 1 \
  --upload-id "VXBsb2FkIElEIGZvciA2aWWpbmcncyBteS1tb3ZpZS5tMnRzIHVwbG9hZA" \
  --body part1.bin \
  --endpoint-url https://v2bucket.discus-likert.ts.net/api/s3
```

**Response**:
```json
{
  "ETag": "5d41402abc4b2a76b9719d911017c592"
}
```

#### Step 3: Complete

```bash
aws s3api complete-multipart-upload \
  --bucket my-bucket \
  --key videos/large.mp4 \
  --upload-id "VXBsb2FkIElEIGZvciA2aWWpbmcncyBteS1tb3ZpZS5tMnRzIHVwbG9hZA" \
  --multipart-upload file://parts.json \
  --endpoint-url https://v2bucket.discus-likert.ts.net/api/s3
```

**parts.json**:
```json
{
  "Parts": [
    { "PartNumber": 1, "ETag": "5d41402abc4b2a76b9719d911017c592" },
    { "PartNumber": 2, "ETag": "7d793037a0760186574b0282f2f435e7" }
  ]
}
```

---

## 11. Error Handling

### Error Response Format

**tRPC Errors** (JSON):
```json
{
  "error": {
    "code": "BUCKET_NOT_FOUND",
    "message": "Bucket 'my-bucket' does not exist",
    "data": {
      "bucketName": "my-bucket"
    }
  }
}
```

**S3 API Errors** (XML):
```xml
<?xml version="1.0" encoding="UTF-8"?>
<Error>
  <Code>NoSuchBucket</Code>
  <Message>The specified bucket does not exist</Message>
  <Resource>/my-bucket</Resource>
  <RequestId>req_xxx</RequestId>
</Error>
```

### Common Error Codes

#### Authentication Errors

| Code | HTTP | Description |
|------|------|-------------|
| `UNAUTHORIZED` | 401 | Not authenticated |
| `FORBIDDEN` | 403 | Insufficient permissions |
| `INVALID_CREDENTIALS` | 401 | Invalid access key or secret |
| `TOKEN_EXPIRED` | 401 | Session token expired |

#### Bucket Errors

| Code | HTTP | Description |
|------|------|-------------|
| `BUCKET_NOT_FOUND` | 404 | Bucket doesn't exist |
| `BUCKET_ALREADY_EXISTS` | 409 | Bucket name taken |
| `BUCKET_NOT_EMPTY` | 409 | Cannot delete non-empty bucket |
| `INVALID_BUCKET_NAME` | 400 | Bucket name doesn't meet requirements |
| `BUCKET_QUOTA_EXCEEDED` | 403 | Max buckets reached |

#### Object Errors

| Code | HTTP | Description |
|------|------|-------------|
| `OBJECT_NOT_FOUND` | 404 | Object doesn't exist |
| `STORAGE_QUOTA_EXCEEDED` | 403 | User storage quota exceeded |
| `INVALID_OBJECT_KEY` | 400 | Object key invalid |
| `PRECONDITION_FAILED` | 412 | ETag mismatch |

#### Multipart Upload Errors

| Code | HTTP | Description |
|------|------|-------------|
| `UPLOAD_NOT_FOUND` | 404 | Multipart upload ID invalid |
| `INVALID_PART` | 400 | Part number invalid (1-10000) |
| `INVALID_PART_ORDER` | 400 | Parts not in sequence |
| `ENTITY_TOO_SMALL` | 400 | Part < 5MB (except last) |
| `ENTITY_TOO_LARGE` | 413 | Part > 5GB |

#### Access Key Errors

| Code | HTTP | Description |
|------|------|-------------|
| `ACCESS_KEY_NOT_FOUND` | 404 | Access key doesn't exist |
| `ACCESS_KEY_INACTIVE` | 403 | Access key is deactivated |
| `ACCESS_KEY_EXPIRED` | 403 | Access key expired |
| `ACCESS_KEY_QUOTA_EXCEEDED` | 403 | Max access keys (10) reached |

#### Rate Limit Errors

| Code | HTTP | Description |
|------|------|-------------|
| `RATE_LIMIT_EXCEEDED` | 429 | Too many requests |

**Response**:
```json
{
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Rate limit exceeded. Try again in 60 seconds.",
    "data": {
      "retryAfter": 60
    }
  }
}
```

---

## 12. Rate Limits & Quotas

### User Quotas

| Resource | Default Limit | Notes |
|----------|---------------|-------|
| Storage | 100 GB | Configurable per user |
| Buckets | 10 | Configurable per user |
| Access Keys | 10 | Hard limit |
| Objects per Bucket | Unlimited | Limited by storage quota |

### API Rate Limits

| Endpoint Type | Limit | Window |
|---------------|-------|--------|
| Authentication | 10 requests | 1 minute |
| tRPC (general) | 100 requests | 1 minute |
| S3 API (read) | 500 requests | 1 minute |
| S3 API (write) | 100 requests | 1 minute |
| Presigned URL generation | 50 requests | 1 minute |

**Rate Limit Headers** (included in responses):
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 75
X-RateLimit-Reset: 1699876543
```

### Object Limits

| Property | Limit | Notes |
|----------|-------|-------|
| Max object size (single upload) | 5 GB | Use multipart for larger |
| Max object size (multipart) | 5 TB | 10,000 parts × 5GB |
| Min part size (multipart) | 5 MB | Except last part |
| Max part size (multipart) | 5 GB | Per part |
| Max parts per upload | 10,000 | Numbered 1-10,000 |
| Max metadata size | 2 KB | Custom metadata only |
| Max key length | 1024 characters | Object key path |

### Presigned URL Limits

| Property | Limit |
|----------|-------|
| Min expiration | 1 second |
| Max expiration | 7 days (604,800 seconds) |
| Default expiration | 1 hour (3600 seconds) |

---

## Appendix A: Complete tRPC Router Reference

### Auth Router
- `auth.register` - Register user
- `auth.login` - Login user
- `auth.logout` - Logout user
- `auth.me` - Get current user
- `auth.updateProfile` - Update profile
- `auth.changePassword` - Change password
- `auth.getSessions` - List sessions
- `auth.revokeSession` - Revoke session
- `auth.revokeAllSessions` - Revoke all sessions

### Bucket Router
- `bucket.create` - Create bucket
- `bucket.list` - List buckets
- `bucket.get` - Get bucket details
- `bucket.delete` - Delete bucket
- `bucket.updateConfig` - Update bucket config
- `bucket.getStats` - Get bucket statistics
- `bucket.checkAvailability` - Check name availability

### Object Router
- `object.upload` - Upload object
- `object.getMetadata` - Get object metadata
- `object.list` - List objects
- `object.delete` - Delete object
- `object.updateMetadata` - Update metadata
- `object.copy` - Copy object
- `object.getStats` - Get object statistics

### Access Key Router
- `accessKey.create` - Create access key
- `accessKey.list` - List access keys
- `accessKey.get` - Get access key
- `accessKey.update` - Update access key
- `accessKey.activate` - Activate key
- `accessKey.deactivate` - Deactivate key
- `accessKey.delete` - Delete access key
- `accessKey.getStats` - Get statistics

### Multipart Upload Router
- `multipart.initiate` - Initiate multipart upload
- `multipart.uploadPart` - Upload part
- `multipart.complete` - Complete upload
- `multipart.abort` - Abort upload
- `multipart.listParts` - List parts
- `multipart.listUploads` - List uploads

### Presigned URL Router
- `presignedUrl.generateGetUrl` - Generate GET URL
- `presignedUrl.generatePutUrl` - Generate PUT URL
- `presignedUrl.generateDeleteUrl` - Generate DELETE URL
- `presignedUrl.list` - List presigned URLs
- `presignedUrl.revoke` - Revoke URL
- `presignedUrl.getStats` - Get statistics

### Bucket Policy Router
- `bucketPolicy.getPolicy` - Get bucket policy
- `bucketPolicy.setPolicy` - Set custom policy
- `bucketPolicy.deletePolicy` - Delete policy
- `bucketPolicy.setPrivatePolicy` - Set private policy
- `bucketPolicy.setPublicReadPolicy` - Set public read policy
- `bucketPolicy.getCORS` - Get CORS config
- `bucketPolicy.setCORS` - Set CORS config
- `bucketPolicy.deleteCORS` - Delete CORS config
- `bucketPolicy.setDefaultCORS` - Set default CORS
- `bucketPolicy.getStatus` - Get policy & CORS status

---

## Appendix B: Page-to-API Mapping Quick Reference

| Page | Primary APIs Used |
|------|-------------------|
| `/` (Login) | `auth.login`, `auth/sign-in/email` |
| `/auth/signup` | `auth.register`, `auth/sign-up/email` |
| `/auth/forgot-password` | `auth/forgot-password` |
| `/auth/reset-password` | `auth/reset-password` |
| `/app` (Dashboard) | `bucket.getStats`, `bucket.list`, `auth.me` |
| `/app/buckets` | `bucket.list`, `bucket.create`, `bucket.delete` |
| `/app/buckets/[name]` | `bucket.get`, `object.list`, `object.upload`, `object.delete` |
| `/app/access-keys` | `accessKey.list`, `accessKey.create`, `accessKey.delete` |
| `/app/analytics` | `/metrics/json`, `accessKey.getStats` |
| `/app/users` | (Future) `user.list`, `user.update` |

---

**Document Version**: 1.0.0
**Last Updated**: 2025-11-10
**Platform**: V2-Bucket S3-Compatible Storage
**API Version**: v1
