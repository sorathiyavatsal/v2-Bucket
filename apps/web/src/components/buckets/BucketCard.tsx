'use client';

import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import {
  Database,
  HardDrive,
  FileText,
  MoreVertical,
  Trash2,
  Settings,
  ExternalLink
} from 'lucide-react';
import { Dropdown, DropdownItem, DropdownSeparator } from '@/components/ui/Dropdown';
import { formatBytes } from '@/lib/utils';

export interface BucketCardProps {
  bucket: {
    name: string;
    region?: string;
    createdAt: Date;
    totalSize: bigint | number;
    objectCount: number;
    storageClass?: string;
  };
  onDelete?: (name: string) => void;
}

export function BucketCard({ bucket, onDelete }: BucketCardProps) {
  const sizeInBytes = typeof bucket.totalSize === 'bigint'
    ? Number(bucket.totalSize)
    : bucket.totalSize;

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <Database className="h-5 w-5 text-primary" />
          </div>
          <div>
            <CardTitle className="text-base">{bucket.name}</CardTitle>
            {bucket.region && (
              <p className="text-xs text-muted-foreground">{bucket.region}</p>
            )}
          </div>
        </div>

        <Dropdown
          align="end"
          trigger={
            <Button variant="ghost" size="icon">
              <MoreVertical className="h-4 w-4" />
            </Button>
          }
        >
          <DropdownItem>
            <Link href={`/app/buckets/${bucket.name}`} className="flex items-center w-full">
              <ExternalLink className="mr-2 h-4 w-4" />
              <span>View Details</span>
            </Link>
          </DropdownItem>
          <DropdownItem>
            <Settings className="mr-2 h-4 w-4" />
            <span>Settings</span>
          </DropdownItem>
          <DropdownSeparator />
          <DropdownItem
            destructive
            onClick={() => onDelete?.(bucket.name)}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            <span>Delete</span>
          </DropdownItem>
        </Dropdown>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <HardDrive className="h-4 w-4" />
            <span>Storage</span>
          </div>
          <span className="text-sm font-medium">{formatBytes(sizeInBytes)}</span>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <FileText className="h-4 w-4" />
            <span>Objects</span>
          </div>
          <span className="text-sm font-medium">{bucket.objectCount.toLocaleString()}</span>
        </div>

        {bucket.storageClass && (
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Storage Class</span>
            <Badge size="sm" variant="secondary">
              {bucket.storageClass}
            </Badge>
          </div>
        )}
      </CardContent>

      <CardFooter className="flex items-center justify-between border-t pt-4">
        <span className="text-xs text-muted-foreground">
          Created {bucket.createdAt.toLocaleDateString()}
        </span>
        <Link href={`/app/buckets/${bucket.name}`}>
          <Button variant="outline" size="sm">
            View Bucket
          </Button>
        </Link>
      </CardFooter>
    </Card>
  );
}
