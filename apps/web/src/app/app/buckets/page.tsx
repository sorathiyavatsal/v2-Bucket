'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Alert, AlertDescription } from '@/components/ui/Alert';
import { BucketCard } from '@/components/buckets/BucketCard';
import { CreateBucketDialog } from '@/components/buckets/CreateBucketDialog';
import { Plus, Search, Loader2 } from 'lucide-react';
import { trpc } from '@/lib/trpc';

export default function BucketsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [error, setError] = useState('');

  // Fetch buckets with tRPC
  const { data: bucketsData, isLoading, refetch } = trpc.bucket.list.useQuery();

  // Create bucket mutation
  const createBucketMutation = trpc.bucket.create.useMutation({
    onSuccess: () => {
      setIsCreateDialogOpen(false);
      setError('');
      refetch(); // Refresh the bucket list
    },
    onError: (error) => {
      setError(error.message);
    },
  });

  // Delete bucket mutation
  const deleteBucketMutation = trpc.bucket.delete.useMutation({
    onSuccess: () => {
      setError('');
      refetch(); // Refresh the bucket list
    },
    onError: (error) => {
      setError(error.message);
    },
  });

  const filteredBuckets = bucketsData?.filter((bucket) =>
    bucket.name.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  const handleCreateBucket = async (data: { name: string; region: string; storageClass: string; acl?: string }) => {
    createBucketMutation.mutate(data);
  };

  const handleDeleteBucket = async (name: string) => {
    if (confirm(`Are you sure you want to delete bucket "${name}"? This action cannot be undone.`)) {
      deleteBucketMutation.mutate({ name });
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

      {/* Error Alert */}
      {error && (
        <Alert variant="error">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

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
        isCreating={createBucketMutation.isPending}
      />
    </div>
  );
}
