'use client';

import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import {
  TrendingUp,
  TrendingDown,
  Database,
  Activity,
  HardDrive,
  Users,
  Download,
  Upload,
  Clock,
} from 'lucide-react';
import { formatBytes } from '@/lib/utils';

// Mock data for storage usage over time
const storageUsageData = [
  { date: '2025-01-01', used: 850, total: 1000 },
  { date: '2025-01-02', used: 920, total: 1000 },
  { date: '2025-01-03', used: 880, total: 1000 },
  { date: '2025-01-04', used: 950, total: 1000 },
  { date: '2025-01-05', used: 1020, total: 1200 },
  { date: '2025-01-06', used: 1100, total: 1200 },
  { date: '2025-01-07', used: 1150, total: 1200 },
];

// Mock data for API requests
const apiRequestsData = [
  { hour: '00:00', GET: 120, PUT: 45, DELETE: 12, POST: 30 },
  { hour: '04:00', GET: 80, PUT: 30, DELETE: 8, POST: 20 },
  { hour: '08:00', GET: 450, PUT: 120, DELETE: 25, POST: 80 },
  { hour: '12:00', GET: 620, PUT: 180, DELETE: 40, POST: 110 },
  { hour: '16:00', GET: 580, PUT: 150, DELETE: 35, POST: 95 },
  { hour: '20:00', GET: 320, PUT: 90, DELETE: 18, POST: 50 },
];

// Mock data for bandwidth usage
const bandwidthData = [
  { date: '2025-01-01', upload: 120, download: 580 },
  { date: '2025-01-02', upload: 150, download: 620 },
  { date: '2025-01-03', upload: 130, download: 550 },
  { date: '2025-01-04', upload: 180, download: 720 },
  { date: '2025-01-05', upload: 160, download: 680 },
  { date: '2025-01-06', upload: 190, download: 750 },
  { date: '2025-01-07', upload: 210, download: 820 },
];

// Mock data for storage by type
const storageByTypeData = [
  { name: 'Documents', value: 320, color: '#3b82f6' },
  { name: 'Images', value: 450, color: '#10b981' },
  { name: 'Videos', value: 180, color: '#f59e0b' },
  { name: 'Archives', value: 200, color: '#8b5cf6' },
];

// Mock data for recent activity
const recentActivity = [
  {
    id: '1',
    action: 'File uploaded',
    user: 'john@example.com',
    bucket: 'production-assets',
    object: 'images/logo.png',
    timestamp: new Date('2025-01-07T14:30:00'),
  },
  {
    id: '2',
    action: 'File deleted',
    user: 'jane@example.com',
    bucket: 'user-uploads',
    object: 'temp/old-file.pdf',
    timestamp: new Date('2025-01-07T14:15:00'),
  },
  {
    id: '3',
    action: 'Bucket created',
    user: 'admin@example.com',
    bucket: 'new-project-2025',
    timestamp: new Date('2025-01-07T13:45:00'),
  },
  {
    id: '4',
    action: 'File downloaded',
    user: 'bob@example.com',
    bucket: 'backups-2025',
    object: 'backup-jan-2025.zip',
    timestamp: new Date('2025-01-07T13:20:00'),
  },
  {
    id: '5',
    action: 'File uploaded',
    user: 'alice@example.com',
    bucket: 'production-assets',
    object: 'videos/demo.mp4',
    timestamp: new Date('2025-01-07T12:50:00'),
  },
];

export default function AnalyticsPage() {
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d'>('7d');

  // Calculate stats
  const currentStorage = storageUsageData[storageUsageData.length - 1];
  const previousStorage = storageUsageData[storageUsageData.length - 2];
  const storageGrowth = ((currentStorage.used - previousStorage.used) / previousStorage.used) * 100;

  const totalRequests = apiRequestsData.reduce(
    (sum, data) => sum + data.GET + data.PUT + data.DELETE + data.POST,
    0
  );
  const totalBandwidth = bandwidthData.reduce(
    (sum, data) => sum + data.upload + data.download,
    0
  );

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Analytics</h1>
          <p className="mt-2 text-muted-foreground">
            Monitor storage usage, API requests, and system activity
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setTimeRange('7d')}
            className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
              timeRange === '7d'
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
          >
            7 Days
          </button>
          <button
            onClick={() => setTimeRange('30d')}
            className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
              timeRange === '30d'
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
          >
            30 Days
          </button>
          <button
            onClick={() => setTimeRange('90d')}
            className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
              timeRange === '90d'
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
          >
            90 Days
          </button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid gap-6 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Storage Usage</CardTitle>
            <HardDrive className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatBytes(currentStorage.used * 1024 * 1024 * 1024)}
            </div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
              {storageGrowth > 0 ? (
                <TrendingUp className="h-3 w-3 text-green-500" />
              ) : (
                <TrendingDown className="h-3 w-3 text-red-500" />
              )}
              <span className={storageGrowth > 0 ? 'text-green-500' : 'text-red-500'}>
                {Math.abs(storageGrowth).toFixed(1)}%
              </span>
              <span>from yesterday</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">API Requests</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalRequests.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground mt-1">Last 24 hours</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Bandwidth</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatBytes(totalBandwidth * 1024 * 1024)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Last 7 days</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Active Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">8</div>
            <p className="text-xs text-muted-foreground mt-1">2 logged in now</p>
          </CardContent>
        </Card>
      </div>

      {/* Storage Usage Over Time */}
      <Card>
        <CardHeader>
          <CardTitle>Storage Usage Over Time</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={storageUsageData}>
              <defs>
                <linearGradient id="colorUsed" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                dataKey="date"
                className="text-xs"
                tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              />
              <YAxis className="text-xs" />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                }}
              />
              <Legend />
              <Area
                type="monotone"
                dataKey="used"
                stroke="#3b82f6"
                fillOpacity={1}
                fill="url(#colorUsed)"
                name="Used (GB)"
              />
              <Area
                type="monotone"
                dataKey="total"
                stroke="#94a3b8"
                fillOpacity={0}
                strokeDasharray="5 5"
                name="Total (GB)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* API Requests and Bandwidth */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* API Requests by Type */}
        <Card>
          <CardHeader>
            <CardTitle>API Requests by Type</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={apiRequestsData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="hour" className="text-xs" />
                <YAxis className="text-xs" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                  }}
                />
                <Legend />
                <Bar dataKey="GET" stackId="a" fill="#3b82f6" />
                <Bar dataKey="PUT" stackId="a" fill="#10b981" />
                <Bar dataKey="POST" stackId="a" fill="#f59e0b" />
                <Bar dataKey="DELETE" stackId="a" fill="#ef4444" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Bandwidth Usage */}
        <Card>
          <CardHeader>
            <CardTitle>Bandwidth Usage</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={bandwidthData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis
                  dataKey="date"
                  className="text-xs"
                  tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                />
                <YAxis className="text-xs" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                  }}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="upload"
                  stroke="#10b981"
                  strokeWidth={2}
                  dot={{ r: 4 }}
                  name="Upload (GB)"
                />
                <Line
                  type="monotone"
                  dataKey="download"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  dot={{ r: 4 }}
                  name="Download (GB)"
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Storage by Type and Activity Log */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Storage by Type */}
        <Card>
          <CardHeader>
            <CardTitle>Storage by Type</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-center">
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={storageByTypeData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {storageByTypeData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                    formatter={(value: number) => formatBytes(value * 1024 * 1024 * 1024)}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-4 space-y-2">
              {storageByTypeData.map((item, index) => (
                <div key={index} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <div
                      className="h-3 w-3 rounded-full"
                      style={{ backgroundColor: item.color }}
                    />
                    <span>{item.name}</span>
                  </div>
                  <span className="font-medium">
                    {formatBytes(item.value * 1024 * 1024 * 1024)}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentActivity.map((activity) => (
                <div key={activity.id} className="flex items-start gap-3 pb-4 border-b last:border-0">
                  <div className="flex-shrink-0 mt-1">
                    {activity.action === 'File uploaded' && (
                      <div className="h-8 w-8 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                        <Upload className="h-4 w-4 text-green-600 dark:text-green-400" />
                      </div>
                    )}
                    {activity.action === 'File downloaded' && (
                      <div className="h-8 w-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                        <Download className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                      </div>
                    )}
                    {activity.action === 'File deleted' && (
                      <div className="h-8 w-8 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                        <Database className="h-4 w-4 text-red-600 dark:text-red-400" />
                      </div>
                    )}
                    {activity.action === 'Bucket created' && (
                      <div className="h-8 w-8 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                        <HardDrive className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{activity.action}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {activity.user} • {activity.bucket}
                      {activity.object && ` / ${activity.object}`}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {activity.timestamp.toLocaleString()}
                    </p>
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
