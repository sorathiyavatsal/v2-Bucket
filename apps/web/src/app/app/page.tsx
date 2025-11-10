'use client';

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Database, HardDrive, FileText, Activity, Loader2 } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import Link from 'next/link';

export default function DashboardPage() {
  const { data: stats, isLoading: statsLoading } = trpc.bucket.getStats.useQuery();
  const { data: bucketsData, isLoading: bucketsLoading } = trpc.bucket.list.useQuery();

  const isLoading = statsLoading || bucketsLoading;

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
        <p className="mt-2 text-muted-foreground">
          Welcome to your V2-Bucket Platform dashboard
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Buckets</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            ) : (
              <>
                <div className="text-2xl font-bold">{stats?.totalBuckets || 0}</div>
                <p className="text-xs text-muted-foreground">
                  {stats?.canCreateMore
                    ? `${stats.maxBuckets - stats.totalBuckets} more available`
                    : 'Limit reached'}
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Storage Used</CardTitle>
            <HardDrive className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            ) : (
              <>
                <div className="text-2xl font-bold">{stats?.formattedSize || '0 B'}</div>
                <p className="text-xs text-muted-foreground">
                  {stats?.storageUsagePercent.toFixed(1)}% of {stats?.formattedQuota}
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Objects</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            ) : (
              <>
                <div className="text-2xl font-bold">{stats?.totalObjects || 0}</div>
                <p className="text-xs text-muted-foreground">Across all buckets</p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Storage Quota</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            ) : (
              <>
                <div className="text-2xl font-bold">{stats?.formattedQuota || '0 B'}</div>
                <p className="text-xs text-muted-foreground">
                  {((Number(stats?.totalSize || 0) / Number(stats?.storageQuota || 1)) * 100).toFixed(1)}% used
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Recent Buckets</CardTitle>
            <CardDescription>Your most recently created buckets</CardDescription>
          </CardHeader>
          <CardContent>
            {bucketsLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : bucketsData?.buckets && bucketsData.buckets.length > 0 ? (
              <div className="space-y-4">
                {bucketsData.buckets.slice(0, 4).map((bucket) => (
                  <Link
                    key={bucket.id}
                    href={`/app/buckets/${bucket.name}`}
                    className="flex items-center justify-between hover:bg-accent rounded-md p-2 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <Database className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium">{bucket.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {bucket.objectCount} objects · {bucket.formattedSize}
                        </p>
                      </div>
                    </div>
                    <Badge variant="success" size="sm">
                      {bucket.status}
                    </Badge>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Database className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">No buckets yet</p>
                <Link href="/app/buckets" className="text-sm text-primary hover:underline mt-2 inline-block">
                  Create your first bucket
                </Link>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quick Stats</CardTitle>
            <CardDescription>Storage overview</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">Storage Usage</span>
                    <span className="text-sm text-muted-foreground">
                      {stats?.storageUsagePercent.toFixed(1)}%
                    </span>
                  </div>
                  <div className="w-full bg-secondary rounded-full h-2">
                    <div
                      className="bg-primary rounded-full h-2 transition-all"
                      style={{ width: `${Math.min(stats?.storageUsagePercent || 0, 100)}%` }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {stats?.formattedSize} of {stats?.formattedQuota}
                  </p>
                </div>

                <div className="pt-4 border-t">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground">Buckets</p>
                      <p className="text-2xl font-bold">{stats?.totalBuckets || 0}</p>
                      <p className="text-xs text-muted-foreground">
                        of {stats?.maxBuckets || 0} max
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Objects</p>
                      <p className="text-2xl font-bold">{stats?.totalObjects || 0}</p>
                      <p className="text-xs text-muted-foreground">Total files</p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
