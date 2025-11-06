// Custom Error Classes for V2-Bucket Platform

export class AppError extends Error {
  constructor(
    public statusCode: number,
    public message: string,
    public code?: string,
    public details?: unknown
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }

  toJSON() {
    return {
      error: this.name,
      message: this.message,
      code: this.code,
      statusCode: this.statusCode,
      details: this.details,
    };
  }
}

// 400 Bad Request
export class BadRequestError extends AppError {
  constructor(message = 'Bad Request', details?: unknown) {
    super(400, message, 'BAD_REQUEST', details);
  }
}

// 401 Unauthorized
export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized', details?: unknown) {
    super(401, message, 'UNAUTHORIZED', details);
  }
}

// 403 Forbidden
export class ForbiddenError extends AppError {
  constructor(message = 'Forbidden', details?: unknown) {
    super(403, message, 'FORBIDDEN', details);
  }
}

// 404 Not Found
export class NotFoundError extends AppError {
  constructor(message = 'Resource not found', details?: unknown) {
    super(404, message, 'NOT_FOUND', details);
  }
}

// 409 Conflict
export class ConflictError extends AppError {
  constructor(message = 'Resource already exists', details?: unknown) {
    super(409, message, 'CONFLICT', details);
  }
}

// 422 Unprocessable Entity
export class ValidationError extends AppError {
  constructor(message = 'Validation failed', details?: unknown) {
    super(422, message, 'VALIDATION_ERROR', details);
  }
}

// 429 Too Many Requests
export class RateLimitError extends AppError {
  constructor(message = 'Too many requests', details?: unknown) {
    super(429, message, 'RATE_LIMIT_EXCEEDED', details);
  }
}

// 500 Internal Server Error
export class InternalServerError extends AppError {
  constructor(message = 'Internal server error', details?: unknown) {
    super(500, message, 'INTERNAL_SERVER_ERROR', details);
  }
}

// 503 Service Unavailable
export class ServiceUnavailableError extends AppError {
  constructor(message = 'Service unavailable', details?: unknown) {
    super(503, message, 'SERVICE_UNAVAILABLE', details);
  }
}

// S3-specific errors
export class BucketNotFoundError extends NotFoundError {
  constructor(bucketName: string) {
    super(`Bucket '${bucketName}' does not exist`, { bucketName });
    this.code = 'NO_SUCH_BUCKET';
  }
}

export class ObjectNotFoundError extends NotFoundError {
  constructor(key: string) {
    super(`Object '${key}' does not exist`, { key });
    this.code = 'NO_SUCH_KEY';
  }
}

export class BucketAlreadyExistsError extends ConflictError {
  constructor(bucketName: string) {
    super(`Bucket '${bucketName}' already exists`, { bucketName });
    this.code = 'BUCKET_ALREADY_EXISTS';
  }
}

export class QuotaExceededError extends ForbiddenError {
  constructor(message = 'Storage quota exceeded') {
    super(message);
    this.code = 'QUOTA_EXCEEDED';
  }
}

export class InvalidAccessKeyError extends UnauthorizedError {
  constructor() {
    super('Invalid access key');
    this.code = 'INVALID_ACCESS_KEY';
  }
}

// Helper function to check if error is an AppError
export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}
