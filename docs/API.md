# V2-Bucket API Documentation

## Overview

V2-Bucket provides two main API interfaces:

1. **S3-Compatible REST API** - Full AWS S3 API compatibility for object storage operations
2. **tRPC API** - Type-safe API for admin dashboard operations

## Base URLs

- **Development**: `http://localhost:3000`
- **Production**: `https://api.your-domain.com`

## Authentication

### Access Keys (S3 API)

S3-compatible API uses AWS Signature Version 4 authentication:

```bash
# Configure AWS CLI
aws configure --profile v2bucket
# Access Key ID: <your-access-key>
# Secret Access Key: <your-secret-key>
```

### JWT Tokens (tRPC API)

Admin dashboard uses JWT token authentication:

```typescript
// Login request
const response = await fetch('/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password })
});
const { token } = await response.json();

// Authenticated request
const data = await fetch('/api/endpoint', {
  headers: { 'Authorization': `Bearer ${token}` }
});
```

## S3-Compatible API

### Bucket Operations

#### List Buckets
```http
GET / HTTP/1.1
Host: localhost:3000
Authorization: AWS4-HMAC-SHA256 ...
```

**Response:**
```xml
<?xml version="1.0" encoding="UTF-8"?>
<ListAllMyBucketsResult>
  <Owner>
    <ID>admin</ID>
    <DisplayName>admin</DisplayName>
  </Owner>
  <Buckets>
    <Bucket>
      <Name>my-bucket</Name>
      <CreationDate>2024-01-15T10:30:00.000Z</CreationDate>
    </Bucket>
  </Buckets>
</ListAllMyBucketsResult>
```

**AWS CLI:**
```bash
aws s3 ls --endpoint-url http://localhost:3000 --profile v2bucket
```

---

#### Create Bucket
```http
PUT /bucket-name HTTP/1.1
Host: localhost:3000
Authorization: AWS4-HMAC-SHA256 ...
```

**Response:**
```http
HTTP/1.1 200 OK
Location: /bucket-name
```

**AWS CLI:**
```bash
aws s3 mb s3://my-bucket --endpoint-url http://localhost:3000 --profile v2bucket
```

---

#### Delete Bucket
```http
DELETE /bucket-name HTTP/1.1
Host: localhost:3000
Authorization: AWS4-HMAC-SHA256 ...
```

**Response:**
```http
HTTP/1.1 204 No Content
```

**AWS CLI:**
```bash
aws s3 rb s3://my-bucket --endpoint-url http://localhost:3000 --profile v2bucket
```

---

#### Head Bucket (Check Existence)
```http
HEAD /bucket-name HTTP/1.1
Host: localhost:3000
Authorization: AWS4-HMAC-SHA256 ...
```

**Response:**
```http
HTTP/1.1 200 OK
```

**AWS CLI:**
```bash
aws s3api head-bucket --bucket my-bucket --endpoint-url http://localhost:3000 --profile v2bucket
```

---

### Object Operations

#### List Objects
```http
GET /bucket-name?list-type=2 HTTP/1.1
Host: localhost:3000
Authorization: AWS4-HMAC-SHA256 ...
```

**Query Parameters:**
- `list-type=2` - Use ListObjectsV2 API
- `prefix` - Filter objects by prefix
- `delimiter` - Group objects by delimiter
- `max-keys` - Maximum objects to return (default: 1000)
- `continuation-token` - Pagination token

**Response:**
```xml
<?xml version="1.0" encoding="UTF-8"?>
<ListBucketResult>
  <Name>my-bucket</Name>
  <Prefix></Prefix>
  <MaxKeys>1000</MaxKeys>
  <IsTruncated>false</IsTruncated>
  <Contents>
    <Key>file.txt</Key>
    <LastModified>2024-01-15T10:30:00.000Z</LastModified>
    <ETag>"d41d8cd98f00b204e9800998ecf8427e"</ETag>
    <Size>1024</Size>
    <StorageClass>STANDARD</StorageClass>
  </Contents>
</ListBucketResult>
```

**AWS CLI:**
```bash
aws s3 ls s3://my-bucket/ --endpoint-url http://localhost:3000 --profile v2bucket
```

---

#### Get Object
```http
GET /bucket-name/object-key HTTP/1.1
Host: localhost:3000
Authorization: AWS4-HMAC-SHA256 ...
```

**Query Parameters:**
- `response-content-type` - Override Content-Type
- `response-content-disposition` - Override Content-Disposition
- `response-cache-control` - Override Cache-Control

**Response:**
```http
HTTP/1.1 200 OK
Content-Type: text/plain
Content-Length: 1024
ETag: "d41d8cd98f00b204e9800998ecf8427e"
Last-Modified: Mon, 15 Jan 2024 10:30:00 GMT

[object data]
```

**AWS CLI:**
```bash
aws s3 cp s3://my-bucket/file.txt . --endpoint-url http://localhost:3000 --profile v2bucket
```

---

#### Put Object
```http
PUT /bucket-name/object-key HTTP/1.1
Host: localhost:3000
Authorization: AWS4-HMAC-SHA256 ...
Content-Type: text/plain
Content-Length: 1024

[object data]
```

**Headers:**
- `Content-Type` - Object content type
- `Content-Length` - Object size
- `x-amz-acl` - Object ACL (private, public-read, etc.)
- `x-amz-meta-*` - Custom metadata
- `x-amz-tagging` - Object tags

**Response:**
```http
HTTP/1.1 200 OK
ETag: "d41d8cd98f00b204e9800998ecf8427e"
```

**AWS CLI:**
```bash
aws s3 cp file.txt s3://my-bucket/ --endpoint-url http://localhost:3000 --profile v2bucket
```

---

#### Delete Object
```http
DELETE /bucket-name/object-key HTTP/1.1
Host: localhost:3000
Authorization: AWS4-HMAC-SHA256 ...
```

**Response:**
```http
HTTP/1.1 204 No Content
```

**AWS CLI:**
```bash
aws s3 rm s3://my-bucket/file.txt --endpoint-url http://localhost:3000 --profile v2bucket
```

---

#### Head Object (Get Metadata)
```http
HEAD /bucket-name/object-key HTTP/1.1
Host: localhost:3000
Authorization: AWS4-HMAC-SHA256 ...
```

**Response:**
```http
HTTP/1.1 200 OK
Content-Type: text/plain
Content-Length: 1024
ETag: "d41d8cd98f00b204e9800998ecf8427e"
Last-Modified: Mon, 15 Jan 2024 10:30:00 GMT
x-amz-meta-custom: value
```

---

### Multipart Upload

#### Initiate Multipart Upload
```http
POST /bucket-name/object-key?uploads HTTP/1.1
Host: localhost:3000
Authorization: AWS4-HMAC-SHA256 ...
Content-Type: application/octet-stream
```

**Response:**
```xml
<?xml version="1.0" encoding="UTF-8"?>
<InitiateMultipartUploadResult>
  <Bucket>my-bucket</Bucket>
  <Key>large-file.bin</Key>
  <UploadId>upload-id-12345</UploadId>
</InitiateMultipartUploadResult>
```

**AWS CLI:**
```bash
aws s3api create-multipart-upload \
  --bucket my-bucket \
  --key large-file.bin \
  --endpoint-url http://localhost:3000 \
  --profile v2bucket
```

---

#### Upload Part
```http
PUT /bucket-name/object-key?partNumber=1&uploadId=upload-id-12345 HTTP/1.1
Host: localhost:3000
Authorization: AWS4-HMAC-SHA256 ...
Content-Length: 5242880

[part data]
```

**Response:**
```http
HTTP/1.1 200 OK
ETag: "part-etag-12345"
```

---

#### Complete Multipart Upload
```http
POST /bucket-name/object-key?uploadId=upload-id-12345 HTTP/1.1
Host: localhost:3000
Authorization: AWS4-HMAC-SHA256 ...
Content-Type: application/xml

<CompleteMultipartUpload>
  <Part>
    <PartNumber>1</PartNumber>
    <ETag>"part-etag-12345"</ETag>
  </Part>
  <Part>
    <PartNumber>2</PartNumber>
    <ETag>"part-etag-67890"</ETag>
  </Part>
</CompleteMultipartUpload>
```

**Response:**
```xml
<?xml version="1.0" encoding="UTF-8"?>
<CompleteMultipartUploadResult>
  <Location>http://localhost:3000/my-bucket/large-file.bin</Location>
  <Bucket>my-bucket</Bucket>
  <Key>large-file.bin</Key>
  <ETag>"final-etag-12345"</ETag>
</CompleteMultipartUploadResult>
```

---

#### Abort Multipart Upload
```http
DELETE /bucket-name/object-key?uploadId=upload-id-12345 HTTP/1.1
Host: localhost:3000
Authorization: AWS4-HMAC-SHA256 ...
```

**Response:**
```http
HTTP/1.1 204 No Content
```

---

## tRPC API

### Test Endpoints

#### test.hello
**Type:** Query
**Description:** Test endpoint that returns a greeting

**Input:**
```typescript
{
  name?: string;
}
```

**Output:**
```typescript
{
  message: string;
}
```

**Example:**
```typescript
const result = await trpc.test.hello.query({ name: 'Claude' });
// Output: { message: 'Hello, Claude!' }
```

**HTTP:**
```bash
curl "http://localhost:3000/trpc/test.hello?input=%7B%22name%22%3A%22Claude%22%7D"
```

---

#### test.echo
**Type:** Mutation
**Description:** Test endpoint that echoes back the input

**Input:**
```typescript
{
  text: string;
}
```

**Output:**
```typescript
{
  echo: string;
}
```

**Example:**
```typescript
const result = await trpc.test.echo.mutate({ text: 'Hello' });
// Output: { echo: 'Hello' }
```

---

### Bucket Endpoints

#### buckets.list
**Type:** Query
**Description:** List all buckets for the authenticated user

**Input:** None

**Output:**
```typescript
{
  id: string;
  name: string;
  region: string;
  createdAt: Date;
  versioning: boolean;
  publicAccess: boolean;
  objectCount: number;
  size: number;
}[]
```

**Example:**
```typescript
const buckets = await trpc.buckets.list.query();
```

---

#### buckets.get
**Type:** Query
**Description:** Get bucket details by name

**Input:**
```typescript
{
  name: string;
}
```

**Output:**
```typescript
{
  id: string;
  name: string;
  region: string;
  createdAt: Date;
  versioning: boolean;
  publicAccess: boolean;
  objectCount: number;
  size: number;
  policy?: object;
  cors?: object;
}
```

---

#### buckets.create
**Type:** Mutation
**Description:** Create a new bucket

**Input:**
```typescript
{
  name: string;
  region?: string;
  versioning?: boolean;
  publicAccess?: boolean;
}
```

**Output:**
```typescript
{
  id: string;
  name: string;
  region: string;
  createdAt: Date;
}
```

**Example:**
```typescript
const bucket = await trpc.buckets.create.mutate({
  name: 'my-new-bucket',
  region: 'us-east-1',
  versioning: true,
  publicAccess: false
});
```

---

#### buckets.delete
**Type:** Mutation
**Description:** Delete a bucket

**Input:**
```typescript
{
  name: string;
}
```

**Output:**
```typescript
{
  success: boolean;
}
```

---

#### buckets.update
**Type:** Mutation
**Description:** Update bucket configuration

**Input:**
```typescript
{
  name: string;
  versioning?: boolean;
  publicAccess?: boolean;
}
```

**Output:**
```typescript
{
  id: string;
  name: string;
  versioning: boolean;
  publicAccess: boolean;
}
```

---

### User Endpoints

#### users.list
**Type:** Query
**Description:** List all users (admin only)

**Input:**
```typescript
{
  page?: number;
  limit?: number;
}
```

**Output:**
```typescript
{
  users: {
    id: string;
    email: string;
    name: string;
    role: 'ADMIN' | 'USER';
    createdAt: Date;
    isActive: boolean;
  }[];
  total: number;
  page: number;
  limit: number;
}
```

---

#### users.get
**Type:** Query
**Description:** Get user details by ID

**Input:**
```typescript
{
  id: string;
}
```

**Output:**
```typescript
{
  id: string;
  email: string;
  name: string;
  role: 'ADMIN' | 'USER';
  createdAt: Date;
  isActive: boolean;
  bucketCount: number;
  storageUsed: number;
}
```

---

#### users.create
**Type:** Mutation
**Description:** Create a new user (admin only)

**Input:**
```typescript
{
  email: string;
  password: string;
  name: string;
  role?: 'ADMIN' | 'USER';
}
```

**Output:**
```typescript
{
  id: string;
  email: string;
  name: string;
  role: 'ADMIN' | 'USER';
}
```

---

#### users.update
**Type:** Mutation
**Description:** Update user details

**Input:**
```typescript
{
  id: string;
  email?: string;
  name?: string;
  role?: 'ADMIN' | 'USER';
  isActive?: boolean;
}
```

**Output:**
```typescript
{
  id: string;
  email: string;
  name: string;
  role: 'ADMIN' | 'USER';
  isActive: boolean;
}
```

---

#### users.delete
**Type:** Mutation
**Description:** Delete a user (admin only)

**Input:**
```typescript
{
  id: string;
}
```

**Output:**
```typescript
{
  success: boolean;
}
```

---

### Access Key Endpoints

#### accessKeys.list
**Type:** Query
**Description:** List all access keys for the authenticated user

**Input:** None

**Output:**
```typescript
{
  id: string;
  accessKeyId: string;
  name: string;
  createdAt: Date;
  lastUsed?: Date;
  isActive: boolean;
}[]
```

---

#### accessKeys.create
**Type:** Mutation
**Description:** Create a new access key

**Input:**
```typescript
{
  name: string;
}
```

**Output:**
```typescript
{
  id: string;
  accessKeyId: string;
  secretAccessKey: string; // Only returned on creation
  name: string;
}
```

**Important:** The `secretAccessKey` is only returned once during creation. Store it securely.

---

#### accessKeys.delete
**Type:** Mutation
**Description:** Delete an access key

**Input:**
```typescript
{
  id: string;
}
```

**Output:**
```typescript
{
  success: boolean;
}
```

---

#### accessKeys.toggle
**Type:** Mutation
**Description:** Enable or disable an access key

**Input:**
```typescript
{
  id: string;
  isActive: boolean;
}
```

**Output:**
```typescript
{
  id: string;
  isActive: boolean;
}
```

---

## Health & Monitoring

### Health Check
```http
GET /health HTTP/1.1
Host: localhost:3000
```

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "uptime": 12345,
  "version": "1.0.0"
}
```

---

### Liveness Probe (Kubernetes)
```http
GET /health/live HTTP/1.1
Host: localhost:3000
```

**Response:**
```json
{
  "status": "alive"
}
```

---

### Readiness Probe (Kubernetes)
```http
GET /health/ready HTTP/1.1
Host: localhost:3000
```

**Response:**
```json
{
  "status": "ready",
  "database": "connected",
  "storage": "connected"
}
```

---

### Metrics (Prometheus)
```http
GET /metrics HTTP/1.1
Host: localhost:3000
```

**Response:**
```
# HELP http_request_duration_seconds HTTP request duration in seconds
# TYPE http_request_duration_seconds histogram
http_request_duration_seconds_bucket{le="0.005",method="GET",route="/health",status="200"} 10
http_request_duration_seconds_bucket{le="0.01",method="GET",route="/health",status="200"} 15
http_request_duration_seconds_sum{method="GET",route="/health",status="200"} 0.123
http_request_duration_seconds_count{method="GET",route="/health",status="200"} 20

# HELP http_requests_total Total number of HTTP requests
# TYPE http_requests_total counter
http_requests_total{method="GET",route="/health",status="200"} 100
```

---

## Error Responses

### S3 API Errors

```xml
<?xml version="1.0" encoding="UTF-8"?>
<Error>
  <Code>NoSuchBucket</Code>
  <Message>The specified bucket does not exist</Message>
  <Resource>/bucket-name</Resource>
  <RequestId>request-id-12345</RequestId>
</Error>
```

**Common Error Codes:**
- `NoSuchBucket` - Bucket does not exist
- `BucketAlreadyExists` - Bucket name already taken
- `NoSuchKey` - Object does not exist
- `InvalidBucketName` - Bucket name is invalid
- `AccessDenied` - Authentication failed or insufficient permissions
- `InvalidAccessKeyId` - Access key ID is invalid
- `SignatureDoesNotMatch` - Request signature is incorrect

---

### tRPC API Errors

```json
{
  "error": {
    "message": "Bucket not found",
    "code": "NOT_FOUND",
    "data": {
      "path": "buckets.get",
      "zodError": null
    }
  }
}
```

**HTTP Status Codes:**
- `200` - Success
- `400` - Bad Request (validation error)
- `401` - Unauthorized (authentication failed)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found
- `409` - Conflict (resource already exists)
- `429` - Too Many Requests (rate limit exceeded)
- `500` - Internal Server Error

---

## Rate Limiting

V2-Bucket implements rate limiting to protect against abuse:

**Default Limits:**
- 100 requests per minute per IP address
- 1000 requests per minute per access key

**Rate Limit Headers:**
```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1642248600
```

**Rate Limit Exceeded Response:**
```http
HTTP/1.1 429 Too Many Requests
Retry-After: 60

{
  "error": "Rate limit exceeded. Please try again in 60 seconds."
}
```

---

## CORS Configuration

CORS is configured to allow cross-origin requests from the web dashboard:

**Allowed Origins:** Configurable via `CORS_ORIGIN` environment variable
**Allowed Methods:** GET, POST, PUT, DELETE, HEAD, OPTIONS
**Allowed Headers:** Authorization, Content-Type, x-amz-*
**Exposed Headers:** ETag, x-amz-request-id
**Max Age:** 86400 seconds (24 hours)

---

## SDK Examples

### JavaScript/TypeScript (AWS SDK v3)

```typescript
import { S3Client, ListBucketsCommand, PutObjectCommand } from '@aws-sdk/client-s3';

const s3Client = new S3Client({
  endpoint: 'http://localhost:3000',
  region: 'us-east-1',
  credentials: {
    accessKeyId: 'your-access-key',
    secretAccessKey: 'your-secret-key'
  },
  forcePathStyle: true
});

// List buckets
const listBuckets = await s3Client.send(new ListBucketsCommand({}));
console.log(listBuckets.Buckets);

// Upload object
await s3Client.send(new PutObjectCommand({
  Bucket: 'my-bucket',
  Key: 'file.txt',
  Body: Buffer.from('Hello, World!')
}));
```

---

### Python (boto3)

```python
import boto3

s3 = boto3.client(
    's3',
    endpoint_url='http://localhost:3000',
    aws_access_key_id='your-access-key',
    aws_secret_access_key='your-secret-key',
    region_name='us-east-1'
)

# List buckets
response = s3.list_buckets()
for bucket in response['Buckets']:
    print(bucket['Name'])

# Upload object
s3.put_object(
    Bucket='my-bucket',
    Key='file.txt',
    Body=b'Hello, World!'
)
```

---

### Go (AWS SDK for Go)

```go
package main

import (
    "context"
    "github.com/aws/aws-sdk-go-v2/aws"
    "github.com/aws/aws-sdk-go-v2/config"
    "github.com/aws/aws-sdk-go-v2/credentials"
    "github.com/aws/aws-sdk-go-v2/service/s3"
)

func main() {
    cfg, _ := config.LoadDefaultConfig(context.TODO(),
        config.WithRegion("us-east-1"),
        config.WithEndpointResolverWithOptions(aws.EndpointResolverWithOptionsFunc(
            func(service, region string, options ...interface{}) (aws.Endpoint, error) {
                return aws.Endpoint{URL: "http://localhost:3000"}, nil
            })),
        config.WithCredentialsProvider(credentials.NewStaticCredentialsProvider(
            "your-access-key",
            "your-secret-key",
            "",
        )),
    )

    client := s3.NewFromConfig(cfg)

    // List buckets
    result, _ := client.ListBuckets(context.TODO(), &s3.ListBucketsInput{})
    for _, bucket := range result.Buckets {
        println(*bucket.Name)
    }
}
```

---

## Versioning

API versioning follows semantic versioning (semver):

**Current Version:** v1.0.0

Breaking changes will increment the major version. The API version is included in response headers:

```http
X-API-Version: 1.0.0
```

---

## Support

For API issues or questions:
- GitHub Issues: Report bugs or request features
- Documentation: Check README and guides
- Community: Join discussions
