'use client';

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Database, HardDrive, Users, Activity } from 'lucide-react';

export default function DashboardPage() {
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
            <div className="text-2xl font-bold">12</div>
            <p className="text-xs text-muted-foreground">+2 from last month</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Storage Used</CardTitle>
            <HardDrive className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">1.2 TB</div>
            <p className="text-xs text-muted-foreground">68% of 1.8 TB</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">8</div>
            <p className="text-xs text-muted-foreground">3 active today</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">API Requests</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">24.5K</div>
            <p className="text-xs text-muted-foreground">+15% from yesterday</p>
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
            <div className="space-y-4">
              {[
                { name: 'production-assets', size: '456 GB', status: 'active' },
                { name: 'user-uploads', size: '234 GB', status: 'active' },
                { name: 'backups-2025', size: '128 GB', status: 'active' },
                { name: 'test-bucket', size: '12 GB', status: 'active' },
              ].map((bucket) => (
                <div key={bucket.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Database className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">{bucket.name}</p>
                      <p className="text-xs text-muted-foreground">{bucket.size}</p>
                    </div>
                  </div>
                  <Badge variant="success" size="sm">
                    {bucket.status}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Activity Feed</CardTitle>
            <CardDescription>Recent actions on your platform</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[
                { action: 'Bucket created', target: 'production-assets', time: '2 minutes ago' },
                { action: 'File uploaded', target: 'user-uploads/image.jpg', time: '15 minutes ago' },
                { action: 'Access key generated', target: 'api-key-prod', time: '1 hour ago' },
                { action: 'User added', target: 'john@example.com', time: '3 hours ago' },
              ].map((activity, i) => (
                <div key={i} className="flex items-start gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
                    <Activity className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex-1 space-y-1">
                    <p className="text-sm font-medium">{activity.action}</p>
                    <p className="text-xs text-muted-foreground">{activity.target}</p>
                    <p className="text-xs text-muted-foreground">{activity.time}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
