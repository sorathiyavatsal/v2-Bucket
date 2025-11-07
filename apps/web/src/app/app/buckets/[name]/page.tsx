'use client';

import { useState } from 'react';
import { use } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { ObjectList } from '@/components/buckets/ObjectList';
import { UploadDialog } from '@/components/buckets/UploadDialog';
import {
  ChevronRight,
  Home,
  Upload,
  RefreshCw,
  HardDrive,
  FileText,
} from 'lucide-react';
import { formatBytes } from '@/lib/utils';

// Mock data
const mockObjects = [
  {
    key: 'documents/',
    size: 0,
    lastModified: new Date('2025-01-10'),
    isFolder: true,
  },
  {
    key: 'images/',
    size: 0,
    lastModified: new Date('2025-01-12'),
    isFolder: true,
  },
  {
    key: 'report-2025.pdf',
    size: 2456789,
    lastModified: new Date('2025-01-15'),
    etag: '"abc123"',
  },
  {
    key: 'data-export.csv',
    size: 1234567,
    lastModified: new Date('2025-01-14'),
    etag: '"def456"',
  },
  {
    key: 'presentation.pptx',
    size: 8765432,
    lastModified: new Date('2025-01-13'),
    etag: '"ghi789"',
  },
];

export default function BucketDetailsPage({
  params,
}: {
  params: Promise<{ name: string }>;
}) {
  const { name } = use(params);
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [objects] = useState(mockObjects);
  const [currentPath, setCurrentPath] = useState('');

  const breadcrumbs = currentPath
    ? ['', ...currentPath.split('/').filter(Boolean)]
    : [''];

  const handleUpload = async (files: File[]) => {
    // TODO: Implement tRPC mutation
    console.log('Uploading files:', files);
    await new Promise(resolve => setTimeout(resolve, 1000));
  };

  const handleDownload = (key: string) => {
    // TODO: Implement download
    console.log('Downloading:', key);
  };

  const handleDelete = (key: string) => {
    // TODO: Implement tRPC mutation
    console.log('Deleting:', key);
  };

  const handleNavigate = (key: string) => {
    setCurrentPath(key);
  };

  // Calculate total size
  const totalSize = objects.reduce((acc, obj) => acc + obj.size, 0);
  const objectCount = objects.filter(obj => !obj.isFolder).length;
  const folderCount = objects.filter(obj => obj.isFolder).length;

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">{decodeURIComponent(name)}</h1>
          <p className="mt-2 text-muted-foreground">
            Browse and manage objects in this bucket
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="icon">
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button onClick={() => setIsUploadDialogOpen(true)}>
            <Upload className="mr-2 h-4 w-4" />
            Upload Files
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-6 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Size</CardTitle>
            <HardDrive className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatBytes(totalSize)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Objects</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{objectCount}</div>
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
                  setCurrentPath(breadcrumbs.slice(1, index + 1).join('/'))
                }
                className="text-primary hover:underline"
              >
                {crumb}
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Objects Table */}
      <Card>
        <CardContent className="p-0">
          <ObjectList
            objects={objects}
            onDownload={handleDownload}
            onDelete={handleDelete}
            onNavigate={handleNavigate}
          />
        </CardContent>
      </Card>

      {/* Upload Dialog */}
      <UploadDialog
        open={isUploadDialogOpen}
        onOpenChange={setIsUploadDialogOpen}
        bucketName={decodeURIComponent(name)}
        currentPath={currentPath}
        onUpload={handleUpload}
      />
    </div>
  );
}
