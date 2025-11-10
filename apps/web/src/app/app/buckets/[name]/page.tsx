'use client';

import { useState, useEffect } from 'react';
import { use } from 'react';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Alert, AlertDescription } from '@/components/ui/Alert';
import { ObjectList } from '@/components/buckets/ObjectList';
import { UploadDialog } from '@/components/buckets/UploadDialog';
import { S3CredentialsSetup } from '@/components/buckets/S3CredentialsSetup';
import {
  ChevronRight,
  Home,
  Upload,
  RefreshCw,
  HardDrive,
  FileText,
  Loader2,
} from 'lucide-react';
import { formatBytes } from '@/lib/utils';
import { useS3 } from '@/components/providers/S3Provider';
import {
  listObjects,
  uploadFile,
  getDownloadUrl,
  deleteObject,
  getFileName,
} from '@/lib/s3-client';
import { trpc } from '@/lib/trpc';

interface S3Object {
  key: string;
  size: number;
  lastModified: Date;
  etag?: string;
  isFolder?: boolean;
}

export default function BucketDetailsPage({
  params,
}: {
  params: Promise<{ name: string }>;
}) {
  const { name } = use(params);
  const { client, isConfigured } = useS3();
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [objects, setObjects] = useState<S3Object[]>([]);
  const [currentPath, setCurrentPath] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // Fetch bucket info from tRPC
  const { data: bucketInfo } = trpc.bucket.get.useQuery(
    { name: decodeURIComponent(name) },
    { enabled: !!name }
  );

  const breadcrumbs = currentPath
    ? ['', ...currentPath.split('/').filter(Boolean)]
    : [''];

  // Load objects when client is configured or path changes
  useEffect(() => {
    if (client && isConfigured) {
      loadObjects();
    }
  }, [client, isConfigured, currentPath, name]);

  const loadObjects = async () => {
    if (!client) return;

    setIsLoading(true);
    setError('');

    try {
      const result = await listObjects(
        client,
        decodeURIComponent(name),
        currentPath || undefined,
        '/' // Use delimiter to get folder structure
      );

      // Combine objects and common prefixes (folders)
      const allObjects: S3Object[] = [
        // Folders
        ...(result.commonPrefixes?.map((prefix) => ({
          key: prefix.Prefix || '',
          size: 0,
          lastModified: new Date(),
          isFolder: true,
        })) || []),
        // Files
        ...(result.objects?.map((obj) => ({
          key: obj.Key || '',
          size: obj.Size || 0,
          lastModified: obj.LastModified || new Date(),
          etag: obj.ETag,
          isFolder: false,
        })) || []),
      ];

      setObjects(allObjects);
    } catch (err) {
      console.error('Failed to load objects:', err);
      setError(err instanceof Error ? err.message : 'Failed to load objects');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpload = async (files: File[]) => {
    if (!client) {
      setError('S3 client not configured');
      return;
    }

    setError('');

    try {
      for (const file of files) {
        const key = currentPath ? `${currentPath}${file.name}` : file.name;
        await uploadFile(client, decodeURIComponent(name), key, file);
      }

      // Reload objects after upload
      await loadObjects();
      setIsUploadDialogOpen(false);
    } catch (err) {
      console.error('Upload failed:', err);
      setError(err instanceof Error ? err.message : 'Upload failed');
      throw err;
    }
  };

  const handleDownload = async (key: string) => {
    if (!client) return;

    try {
      const url = await getDownloadUrl(client, decodeURIComponent(name), key);
      window.open(url, '_blank');
    } catch (err) {
      console.error('Download failed:', err);
      setError(err instanceof Error ? err.message : 'Download failed');
    }
  };

  const handleDelete = async (key: string) => {
    if (!client) return;

    if (!confirm(`Are you sure you want to delete "${getFileName(key)}"?`)) {
      return;
    }

    setError('');

    try {
      await deleteObject(client, decodeURIComponent(name), key);
      await loadObjects();
    } catch (err) {
      console.error('Delete failed:', err);
      setError(err instanceof Error ? err.message : 'Delete failed');
    }
  };

  const handleNavigate = (key: string) => {
    setCurrentPath(key);
  };

  const handleRefresh = () => {
    loadObjects();
  };

  // Calculate total size
  const totalSize = objects.reduce((acc, obj) => acc + obj.size, 0);
  const objectCount = objects.filter((obj) => !obj.isFolder).length;
  const folderCount = objects.filter((obj) => obj.isFolder).length;

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">
            {decodeURIComponent(name)}
          </h1>
          <p className="mt-2 text-muted-foreground">
            Browse and manage objects in this bucket
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={handleRefresh}
            disabled={!isConfigured || isLoading}
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
          <Button
            onClick={() => setIsUploadDialogOpen(true)}
            disabled={!isConfigured}
          >
            <Upload className="mr-2 h-4 w-4" />
            Upload Files
          </Button>
        </div>
      </div>

      {/* S3 Credentials Setup */}
      <S3CredentialsSetup />

      {/* Error Alert */}
      {error && (
        <Alert variant="error">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Stats */}
      <div className="grid gap-6 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Size</CardTitle>
            <HardDrive className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {bucketInfo?.formattedSize || formatBytes(totalSize)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Objects</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {bucketInfo?.objectCount || objectCount}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Folders</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{folderCount}</div>
          </CardContent>
        </Card>
      </div>

      {/* Breadcrumb */}
      {isConfigured && (
        <div className="flex items-center gap-2 text-sm">
          {breadcrumbs.map((crumb, index) => (
            <div key={index} className="flex items-center gap-2">
              {index > 0 && <ChevronRight className="h-4 w-4 text-muted-foreground" />}
              {index === 0 ? (
                <button
                  onClick={() => setCurrentPath('')}
                  className="flex items-center gap-1 text-primary hover:underline"
                >
                  <Home className="h-4 w-4" />
                  <span>{decodeURIComponent(name)}</span>
                </button>
              ) : (
                <button
                  onClick={() =>
                    setCurrentPath(breadcrumbs.slice(1, index + 1).join('/') + '/')
                  }
                  className="text-primary hover:underline"
                >
                  {crumb}
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Objects Table */}
      {isConfigured ? (
        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : objects.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-lg font-medium text-foreground">No objects found</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  Upload files to get started
                </p>
                <Button
                  onClick={() => setIsUploadDialogOpen(true)}
                  className="mt-4"
                >
                  <Upload className="mr-2 h-4 w-4" />
                  Upload Files
                </Button>
              </div>
            ) : (
              <ObjectList
                objects={objects}
                onDownload={handleDownload}
                onDelete={handleDelete}
                onNavigate={handleNavigate}
              />
            )}
          </CardContent>
        </Card>
      ) : (
        <Alert>
          <AlertDescription>
            Configure your S3 access credentials above to view and manage objects.
          </AlertDescription>
        </Alert>
      )}

      {/* Upload Dialog */}
      {isConfigured && (
        <UploadDialog
          open={isUploadDialogOpen}
          onOpenChange={setIsUploadDialogOpen}
          bucketName={decodeURIComponent(name)}
          currentPath={currentPath}
          onUpload={handleUpload}
        />
      )}
    </div>
  );
}
