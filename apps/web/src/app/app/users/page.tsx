'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/Table';
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogContent,
  DialogFooter,
} from '@/components/ui/Dialog';
import { Plus, Search, MoreVertical, Trash2, Edit, Shield } from 'lucide-react';
import { Dropdown, DropdownItem, DropdownSeparator } from '@/components/ui/Dropdown';
import { formatBytes } from '@/lib/utils';

// Mock data
const mockUsers = [
  {
    id: '1',
    name: 'John Doe',
    email: 'john@example.com',
    role: 'admin' as const,
    quotaUsed: 123456789012,
    quotaLimit: 1099511627776,
    status: 'active' as const,
    createdAt: new Date('2024-01-15'),
  },
  {
    id: '2',
    name: 'Jane Smith',
    email: 'jane@example.com',
    role: 'user' as const,
    quotaUsed: 456789012,
    quotaLimit: 107374182400,
    status: 'active' as const,
    createdAt: new Date('2024-03-20'),
  },
  {
    id: '3',
    name: 'Bob Wilson',
    email: 'bob@example.com',
    role: 'user' as const,
    quotaUsed: 789012345,
    quotaLimit: 107374182400,
    status: 'suspended' as const,
    createdAt: new Date('2024-06-10'),
  },
];

export default function UsersPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [users] = useState(mockUsers);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    role: 'user',
    quotaLimit: '100',
  });

  const filteredUsers = users.filter(
    (user) =>
      user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCreateUser = async () => {
    // TODO: Implement tRPC mutation
    console.log('Creating user:', formData);
    await new Promise(resolve => setTimeout(resolve, 1000));
    setIsCreateDialogOpen(false);
    setFormData({ name: '', email: '', role: 'user', quotaLimit: '100' });
  };

  const calculateQuotaPercentage = (used: number, limit: number) => {
    return ((used / limit) * 100).toFixed(1);
  };

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Users</h1>
          <p className="mt-2 text-muted-foreground">
            Manage user accounts and permissions
          </p>
        </div>
        <Button onClick={() => setIsCreateDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add User
        </Button>
      </div>

      {/* Search Bar */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search users..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Users Table */}
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Storage Quota</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredUsers.map((user) => (
              <TableRow key={user.id}>
                <TableCell className="font-medium">{user.name}</TableCell>
                <TableCell className="text-muted-foreground">{user.email}</TableCell>
                <TableCell>
                  <Badge
                    variant={user.role === 'admin' ? 'default' : 'secondary'}
                    size="sm"
                  >
                    {user.role === 'admin' && <Shield className="mr-1 h-3 w-3" />}
                    {user.role}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="space-y-1">
                    <div className="text-sm">
                      {formatBytes(user.quotaUsed)} / {formatBytes(user.quotaLimit)}
                    </div>
                    <div className="h-1.5 w-24 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary"
                        style={{
                          width: `${calculateQuotaPercentage(user.quotaUsed, user.quotaLimit)}%`,
                        }}
                      />
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge
                    variant={user.status === 'active' ? 'success' : 'warning'}
                    size="sm"
                  >
                    {user.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {user.createdAt.toLocaleDateString()}
                </TableCell>
                <TableCell>
                  <Dropdown
                    align="end"
                    trigger={
                      <Button variant="ghost" size="icon">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    }
                  >
                    <DropdownItem>
                      <Edit className="mr-2 h-4 w-4" />
                      <span>Edit User</span>
                    </DropdownItem>
                    <DropdownItem>
                      <Shield className="mr-2 h-4 w-4" />
                      <span>Change Role</span>
                    </DropdownItem>
                    <DropdownSeparator />
                    <DropdownItem destructive>
                      <Trash2 className="mr-2 h-4 w-4" />
                      <span>Delete User</span>
                    </DropdownItem>
                  </Dropdown>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Create User Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogHeader>
          <DialogTitle>Add New User</DialogTitle>
        </DialogHeader>
        <DialogContent>
          <div className="space-y-4">
            <Input
              label="Name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="John Doe"
              required
            />
            <Input
              label="Email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="john@example.com"
              required
            />
            <div>
              <label className="mb-2 block text-sm font-medium text-foreground">
                Role
              </label>
              <select
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="user">User</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <Input
              label="Storage Quota (GB)"
              type="number"
              value={formData.quotaLimit}
              onChange={(e) => setFormData({ ...formData, quotaLimit: e.target.value })}
              placeholder="100"
              required
            />
          </div>
        </DialogContent>
        <DialogFooter>
          <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleCreateUser}>Create User</Button>
        </DialogFooter>
      </Dialog>
    </div>
  );
}
