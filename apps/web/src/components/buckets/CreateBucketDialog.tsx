'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogContent,
  DialogFooter,
} from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Alert, AlertDescription } from '@/components/ui/Alert';

export interface CreateBucketDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate?: (data: { name: string; region: string; storageClass: string }) => Promise<void> | void;
  isCreating?: boolean;
}

export function CreateBucketDialog({ open, onOpenChange, onCreate, isCreating = false }: CreateBucketDialogProps) {
  const [formData, setFormData] = useState({
    name: '',
    region: 'us-east-1',
    storageClass: 'STANDARD',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState('');

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Bucket name is required';
    } else if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(formData.name)) {
      newErrors.name = 'Bucket name must be lowercase letters, numbers, and hyphens only';
    } else if (formData.name.length < 3 || formData.name.length > 63) {
      newErrors.name = 'Bucket name must be between 3 and 63 characters';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError('');

    if (!validateForm()) {
      return;
    }

    try {
      await onCreate?.(formData);
      // Reset form (dialog will be closed by parent on success)
      setFormData({ name: '', region: 'us-east-1', storageClass: 'STANDARD' });
    } catch (error) {
      setServerError(error instanceof Error ? error.message : 'Failed to create bucket');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogHeader>
        <DialogTitle>Create New Bucket</DialogTitle>
        <DialogDescription>
          Create a new S3-compatible storage bucket
        </DialogDescription>
      </DialogHeader>

      <DialogContent>
        {serverError && (
          <Alert variant="error" className="mb-4">
            <AlertDescription>{serverError}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Bucket Name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value.toLowerCase() })}
            error={errors.name}
            placeholder="my-bucket-name"
            helperText="Must be globally unique, lowercase, 3-63 characters"
            required
          />

          <div>
            <label className="mb-2 block text-sm font-medium text-foreground">
              Region
            </label>
            <select
              value={formData.region}
              onChange={(e) => setFormData({ ...formData, region: e.target.value })}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <option value="us-east-1">US East (N. Virginia)</option>
              <option value="us-west-2">US West (Oregon)</option>
              <option value="eu-west-1">EU (Ireland)</option>
              <option value="ap-southeast-1">Asia Pacific (Singapore)</option>
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-foreground">
              Storage Class
            </label>
            <select
              value={formData.storageClass}
              onChange={(e) => setFormData({ ...formData, storageClass: e.target.value })}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <option value="STANDARD">Standard</option>
              <option value="STANDARD_IA">Standard-IA (Infrequent Access)</option>
              <option value="GLACIER">Glacier (Archive)</option>
            </select>
          </div>
        </form>
      </DialogContent>

      <DialogFooter>
        <Button
          type="button"
          variant="outline"
          onClick={() => onOpenChange(false)}
          disabled={isCreating}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          onClick={handleSubmit}
          disabled={isCreating}
        >
          {isCreating ? 'Creating...' : 'Create Bucket'}
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
