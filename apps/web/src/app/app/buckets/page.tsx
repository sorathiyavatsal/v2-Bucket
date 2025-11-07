'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Alert, AlertDescription } from '@/components/ui/Alert';
import { BucketCard } from '@/components/buckets/BucketCard';
import { CreateBucketDialog } from '@/components/buckets/CreateBucketDialog';
import { Plus, Search, Loader2 } from 'lucide-react';

// Mock data - will be replaced with tRPC calls
const mockBuckets = [
  {
    name: 'production-assets',
    region: 'us-east-1',
    createdAt: new Date('2024-01-15'),
    totalSize: 456000000000,
    objectCount: 1234,
    storageClass: 'STANDARD',
  },
  {
    name: 'user-uploads',
    region: 'us-west-2',
    createdAt: new Date('2024-02-20'),
    totalSize: 234000000000,
    objectCount: 5678,
    storageClass: 'STANDARD',
  },
  {
    name: 'backups-2025',
    region: 'us-east-1',
    createdAt: new Date('2025-01-01'),
    totalSize: 128000000000,
    objectCount: 234,
    storageClass: 'GLACIER',
  },
  {
    name: 'test-bucket',
    region: 'eu-west-1',
    createdAt: new Date('2025-01-05'),
    totalSize: 12000000000,
    objectCount: 45,
    storageClass: 'STANDARD',
  },
];

export default function BucketsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [buckets] = useState(mockBuckets);
  const [isLoading] = useState(false);

  const filteredBuckets = buckets.filter((bucket) =>
    bucket.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCreateBucket = async (data: { name: string; region: string; storageClass: string }) => {
    // TODO: Implement tRPC mutation
    console.log('Creating bucket:', data);
    await new Promise(resolve => setTimeout(resolve, 1000));
  };

  const handleDeleteBucket = async (name: string) => {
    // TODO: Implement delete confirmation and tRPC mutation
    if (confirm(`Are you sure you want to delete bucket "${name}"?`)) {
      console.log('Deleting bucket:', name);
    }
  };

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Buckets</h1>
          <p className="mt-2 text-muted-foreground">
            Manage your S3-compatible storage buckets
          </p>
        </div>
        <Button onClick={() => setIsCreateDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Create Bucket
        </Button>
      </div>

      {/* Search Bar */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search buckets..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Buckets Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : filteredBuckets.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          {searchQuery ? (
            <>
              <p className="text-lg font-medium text-foreground">No buckets found</p>
              <p className="mt-2 text-sm text-muted-foreground">
                Try adjusting your search query
              </p>
            </>
          ) : (
            <>
              <p className="text-lg font-medium text-foreground">No buckets yet</p>
              <p className="mt-2 text-sm text-muted-foreground">
                Create your first bucket to get started
              </p>
              <Button onClick={() => setIsCreateDialogOpen(true)} className="mt-4">
                <Plus className="mr-2 h-4 w-4" />
                Create Bucket
              </Button>
            </>
          )}
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredBuckets.map((bucket) => (
            <BucketCard
              key={bucket.name}
              bucket={bucket}
              onDelete={handleDeleteBucket}
            />
          ))}
        </div>
      )}

      {/* Create Bucket Dialog */}
      <CreateBucketDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        onCreate={handleCreateBucket}
      />
    </div>
  );
}
