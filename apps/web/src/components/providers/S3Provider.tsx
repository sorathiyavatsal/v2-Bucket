'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { S3Client } from '@aws-sdk/client-s3';
import { createS3Client } from '@/lib/s3-client';

interface S3ContextType {
  client: S3Client | null;
  accessKeyId: string | null;
  secretAccessKey: string | null;
  isConfigured: boolean;
  setCredentials: (accessKeyId: string, secretAccessKey: string) => void;
  clearCredentials: () => void;
}

const S3Context = createContext<S3ContextType | undefined>(undefined);

const STORAGE_KEY = 'v2bucket_s3_credentials';

export function S3Provider({ children }: { children: ReactNode }) {
  const [client, setClient] = useState<S3Client | null>(null);
  const [accessKeyId, setAccessKeyId] = useState<string | null>(null);
  const [secretAccessKey, setSecretAccessKey] = useState<string | null>(null);

  // Load credentials from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const credentials = JSON.parse(stored);
        if (credentials.accessKeyId && credentials.secretAccessKey) {
          setCredentials(credentials.accessKeyId, credentials.secretAccessKey);
        }
      }
    } catch (error) {
      console.error('Failed to load S3 credentials:', error);
    }
  }, []);

  const setCredentials = (newAccessKeyId: string, newSecretAccessKey: string) => {
    setAccessKeyId(newAccessKeyId);
    setSecretAccessKey(newSecretAccessKey);

    // Create S3 client
    const newClient = createS3Client({
      accessKeyId: newAccessKeyId,
      secretAccessKey: newSecretAccessKey,
    });
    setClient(newClient);

    // Store in localStorage
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          accessKeyId: newAccessKeyId,
          secretAccessKey: newSecretAccessKey,
        })
      );
    } catch (error) {
      console.error('Failed to save S3 credentials:', error);
    }
  };

  const clearCredentials = () => {
    setAccessKeyId(null);
    setSecretAccessKey(null);
    setClient(null);

    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      console.error('Failed to clear S3 credentials:', error);
    }
  };

  const value: S3ContextType = {
    client,
    accessKeyId,
    secretAccessKey,
    isConfigured: !!client,
    setCredentials,
    clearCredentials,
  };

  return <S3Context.Provider value={value}>{children}</S3Context.Provider>;
}

export function useS3() {
  const context = useContext(S3Context);
  if (!context) {
    throw new Error('useS3 must be used within S3Provider');
  }
  return context;
}
