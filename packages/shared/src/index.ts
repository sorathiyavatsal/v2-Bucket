// Shared types and utilities for V2-Bucket Platform

export type User = {
  id: string;
  email: string;
  name: string | null;
  isAdmin: boolean;
};

export type Bucket = {
  id: string;
  name: string;
  region: string;
  isPublic: boolean;
};

export type S3Object = {
  id: string;
  key: string;
  size: bigint;
  contentType: string;
  etag: string;
};

// Utility functions
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

export function generateId(): string {
  return crypto.randomUUID();
}
