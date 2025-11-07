# Native S3 Storage Implementation Plan

## 🎯 Overview

This document outlines the implementation plan for **removing MinIO** and building a **native S3-compatible storage engine** directly into V2-Bucket.

**Good News**: The database schema is already perfectly designed for native storage! We just need to implement the storage layer and S3 API endpoints.

---

## ✅ What We Already Have

### Database Schema (Complete)
- ✅ **User** model with storage quotas
- ✅ **Bucket** model with all S3 features (versioning, encryption, CORS, policies)
- ✅ **Object** model with `physicalPath` field for disk storage
- ✅ **MultipartUpload** and **MultipartPart** models
- ✅ **AccessKey** model for AWS Signature V4 authentication
- ✅ **AuditLog** model for tracking all operations
- ✅ **PresignedUrl** model for temporary access

### Infrastructure
- ✅ Fastify server setup
- ✅ PostgreSQL database
- ✅ tRPC for admin API
- ✅ Authentication system

---

## 🔧 What We Need to Build

### Phase 1: Storage Service Layer (Week 1)
**Files to Create:**

1. **`apps/api/src/services/storage.service.ts`**
   ```typescript
   class StorageService {
     - createBucket(name: string): Promise<void>
     - deleteBucket(name: string): Promise<void>
     - putObject(bucket, key, stream): Promise<ObjectMetadata>
     - getObject(bucket, key): Promise<ReadableStream>
     - deleteObject(bucket, key): Promise<void>
     - listObjects(bucket, options): Promise<ObjectList>
     - headObject(bucket, key): Promise<ObjectMetadata>
     - copyObject(source, dest): Promise<void>
   }
   ```

2. **`apps/api/src/services/multipart.service.ts`**
   ```typescript
   class MultipartService {
     - initiateUpload(bucket, key): Promise<uploadId>
     - uploadPart(uploadId, partNumber, stream): Promise<partETag>
     - completeUpload(uploadId, parts[]): Promise<object>
     - abortUpload(uploadId): Promise<void>
     - listParts(uploadId): Promise<parts[]>
   }
   ```

3. **`apps/api/src/lib/file-storage.ts`**
   ```typescript
   class FileStorage {
     - write(path, stream): Promise<size>
     - read(path): Promise<ReadableStream>
     - delete(path): Promise<void>
     - exists(path): Promise<boolean>
     - getSize(path): Promise<number>
     - calculateMD5(stream): Promise<string>
     - concatenateFiles(paths[], output): Promise<void>
   }
   ```

4. **`apps/api/src/lib/path-resolver.ts`**
   ```typescript
   class PathResolver {
     - getBucketPath(bucketName): string
     - getObjectPath(bucket, key): string
     - getMultipartPath(uploadId, partNumber): string
     - getTempPath(uploadId): string
     - sanitizePath(path): string
   }
   ```

---

### Phase 2: S3 API Routes (Week 2-3)

**Files to Create:**

1. **`apps/api/src/routes/s3/index.ts`**
   - Main S3 router setup
   - Route registration
   - AWS Signature V4 auth middleware

2. **`apps/api/src/routes/s3/buckets.ts`**
   ```typescript
   Routes:
   - GET  /                    → ListBuckets
   - PUT  /{bucket}            → CreateBucket
   - DELETE /{bucket}          → DeleteBucket
   - HEAD /{bucket}            → HeadBucket
   - GET  /{bucket}?location   → GetBucketLocation
   - GET  /{bucket}?versioning → GetBucketVersioning
   - PUT  /{bucket}?versioning → PutBucketVersioning
   - GET  /{bucket}?cors       → GetBucketCors
   - PUT  /{bucket}?cors       → PutBucketCors
   - GET  /{bucket}?policy     → GetBucketPolicy
   - PUT  /{bucket}?policy     → PutBucketPolicy
   ```

3. **`apps/api/src/routes/s3/objects.ts`**
   ```typescript
   Routes:
   - PUT  /{bucket}/{key}                 → PutObject
   - GET  /{bucket}/{key}                 → GetObject
   - DELETE /{bucket}/{key}               → DeleteObject
   - HEAD /{bucket}/{key}                 → HeadObject
   - PUT  /{bucket}/{key} (copy-source)   → CopyObject
   - GET  /{bucket}?list-type=2           → ListObjectsV2
   - GET  /{bucket}/{key}?tagging         → GetObjectTagging
   - PUT  /{bucket}/{key}?tagging         → PutObjectTagging
   ```

4. **`apps/api/src/routes/s3/multipart.ts`**
   ```typescript
   Routes:
   - POST   /{bucket}/{key}?uploads                    → InitiateMultipartUpload
   - PUT    /{bucket}/{key}?partNumber=N&uploadId=ID   → UploadPart
   - POST   /{bucket}/{key}?uploadId=ID                → CompleteMultipartUpload
   - DELETE /{bucket}/{key}?uploadId=ID                → AbortMultipartUpload
   - GET    /{bucket}/{key}?uploadId=ID                → ListParts
   - GET    /{bucket}?uploads                          → ListMultipartUploads
   ```

---

### Phase 3: AWS Signature V4 Authentication (Week 4)

**Files to Create:**

1. **`apps/api/src/middleware/aws-signature-v4.ts`**
   ```typescript
   class AWSSignatureV4 {
     - parseAuthorizationHeader(header): AuthParams
     - extractAccessKeyId(header): string
     - createCanonicalRequest(request): string
     - createStringToSign(canonical, date, region): string
     - calculateSignature(stringToSign, secretKey): string
     - verifySignature(request): boolean
   }
   ```

2. **`apps/api/src/lib/aws-helpers.ts`**
   ```typescript
   - parseAuthHeader(header): object
   - getCanonicalHeaders(headers): string
   - getSignedHeaders(headers): string
   - hashPayload(body): string
   - getCredentialScope(date, region, service): string
   ```

---

### Phase 4: XML Response Builders (Week 4)

**Files to Create:**

1. **`apps/api/src/lib/xml-builder.ts`**
   ```typescript
   class S3XmlBuilder {
     - listBucketsResponse(buckets[]): string
     - listObjectsV2Response(objects[], options): string
     - errorResponse(code, message, resource): string
     - initiateMultipartUploadResponse(uploadId): string
     - completeMultipartUploadResponse(object): string
     - listPartsResponse(parts[]): string
   }
   ```

---

### Phase 5: Advanced Features (Week 5)

**Files to Create:**

1. **`apps/api/src/services/versioning.service.ts`**
   - Handle object versioning
   - List versions
   - Delete specific versions
   - Version cleanup

2. **`apps/api/src/services/policy.service.ts`**
   - Parse bucket policies
   - Evaluate permissions
   - Check access rules

3. **`apps/api/src/services/cors.service.ts`**
   - Handle CORS preflight
   - Validate CORS rules
   - Set CORS headers

4. **`apps/api/src/services/tagging.service.ts`**
   - Add/remove tags
   - Query by tags
   - Tag-based access control

---

## 📁 File Storage Directory Structure

```
/storage/
├── buckets/
│   ├── bucket-1/
│   │   ├── objects/
│   │   │   ├── file1.pdf
│   │   │   ├── folder/
│   │   │   │   └── file2.jpg
│   │   │   └── another-file.txt
│   │   └── multipart/
│   │       ├── upload-id-1/
│   │       │   ├── part-1
│   │       │   ├── part-2
│   │       │   └── part-3
│   │       └── upload-id-2/
│   │           └── part-1
│   ├── bucket-2/
│   │   └── objects/
│   └── bucket-3/
│       └── objects/
└── temp/
    └── uploads/
```

**Path Generation Logic:**
```typescript
// Object path: /storage/buckets/{bucket}/objects/{key}
const objectPath = path.join(
  process.env.STORAGE_PATH,
  'buckets',
  bucketName,
  'objects',
  objectKey
);

// Multipart path: /storage/buckets/{bucket}/multipart/{uploadId}/part-{N}
const partPath = path.join(
  process.env.STORAGE_PATH,
  'buckets',
  bucketName,
  'multipart',
  uploadId,
  `part-${partNumber}`
);
```

---

## ⚙️ Environment Variables

**Add to `.env`:**
```env
# Storage Configuration (NEW)
STORAGE_PATH=/storage
STORAGE_MAX_FILE_SIZE=5368709120  # 5GB
STORAGE_MULTIPART_PART_SIZE=5242880  # 5MB minimum
STORAGE_TEMP_PATH=/storage/temp

# Remove MinIO Variables (DELETE)
# MINIO_ENDPOINT=minio
# MINIO_PORT=9000
# MINIO_ROOT_USER=minioadmin
# MINIO_ROOT_PASSWORD=minioadmin
# MINIO_USE_SSL=false
```

---

## 📦 NPM Packages to Install

```bash
cd apps/api

# XML parsing/building
pnpm add fast-xml-parser

# File system utilities
pnpm add fs-extra

# Streaming utilities
pnpm add @fastify/multipart

# Crypto utilities (for MD5, ETags)
# Already available in Node.js crypto module
```

---

## 🔄 Migration Steps

### Step 1: Install Dependencies
```bash
cd apps/api
pnpm add fast-xml-parser fs-extra @fastify/multipart
```

### Step 2: Update Environment
```bash
# Remove MinIO from docker-compose.yml
# Add STORAGE_PATH to .env
```

### Step 3: Implement Storage Layer
```bash
# Create all service files
# Implement file storage operations
```

### Step 4: Implement S3 Routes
```bash
# Create S3 route handlers
# Implement AWS Sig V4 auth
```

### Step 5: Test with AWS CLI
```bash
# Configure AWS CLI
aws configure --profile v2bucket

# Test operations
aws s3 ls --endpoint-url http://localhost:3000 --profile v2bucket
aws s3 mb s3://test-bucket --endpoint-url http://localhost:3000 --profile v2bucket
aws s3 cp file.txt s3://test-bucket/ --endpoint-url http://localhost:3000 --profile v2bucket
```

---

## 🎯 Implementation Priority

### Must Have (MVP)
1. ✅ Storage service with basic file operations
2. ✅ Bucket CRUD operations
3. ✅ Object PUT/GET/DELETE
4. ✅ AWS Signature V4 authentication
5. ✅ List buckets and objects
6. ✅ Multipart upload (basic)

### Should Have (V2)
7. ⏳ Object versioning
8. ⏳ Bucket policies
9. ⏳ CORS support
10. ⏳ Object tagging
11. ⏳ Presigned URLs

### Nice to Have (V3)
12. ⏳ Server-side encryption
13. ⏳ Lifecycle policies
14. ⏳ Replication
15. ⏳ Analytics

---

## 📊 Testing Strategy

### Unit Tests
```typescript
// storage.service.test.ts
describe('StorageService', () => {
  test('should create bucket directory', async () => {
    const service = new StorageService();
    await service.createBucket('test-bucket');
    expect(fs.existsSync('/storage/buckets/test-bucket')).toBe(true);
  });

  test('should upload object', async () => {
    const service = new StorageService();
    const stream = fs.createReadStream('test.txt');
    const result = await service.putObject('test-bucket', 'file.txt', stream);
    expect(result.etag).toBeDefined();
  });
});
```

### Integration Tests
```typescript
// s3-api.test.ts
describe('S3 API', () => {
  test('PUT object should work', async () => {
    const response = await fetch('http://localhost:3000/test-bucket/file.txt', {
      method: 'PUT',
      body: 'Hello World',
      headers: {
        'Authorization': 'AWS4-HMAC-SHA256 ...',
      }
    });
    expect(response.status).toBe(200);
  });
});
```

### AWS CLI Tests
```bash
#!/bin/bash
# test-s3-api.sh

# Test bucket operations
aws s3 mb s3://test-bucket --endpoint-url http://localhost:3000
aws s3 ls --endpoint-url http://localhost:3000
aws s3 rb s3://test-bucket --endpoint-url http://localhost:3000

# Test object operations
echo "Hello World" > test.txt
aws s3 cp test.txt s3://test-bucket/ --endpoint-url http://localhost:3000
aws s3 ls s3://test-bucket/ --endpoint-url http://localhost:3000
aws s3 cp s3://test-bucket/test.txt downloaded.txt --endpoint-url http://localhost:3000
aws s3 rm s3://test-bucket/test.txt --endpoint-url http://localhost:3000
```

---

## 🚀 Next Steps

Ready to start implementation? Here's the order:

1. **Week 1**: Implement storage service layer
2. **Week 2**: Implement basic S3 bucket operations
3. **Week 3**: Implement object operations
4. **Week 4**: Implement AWS Signature V4 auth
5. **Week 5**: Implement multipart upload
6. **Week 6**: Testing and optimization

**Estimated Total Time**: 6 weeks (80 hours)

---

## 📞 Support

If you have questions during implementation:
1. Refer to AWS S3 API documentation
2. Check MinIO source code for reference
3. Test with AWS CLI at each step
4. Use Postman for debugging requests

---

**Let me know when you're ready to start, and I'll begin creating the implementation files!** 🚀
