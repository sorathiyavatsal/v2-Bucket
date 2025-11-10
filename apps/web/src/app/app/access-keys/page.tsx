'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
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
  DialogDescription,
  DialogContent,
  DialogFooter,
} from '@/components/ui/Dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/Alert';
import { Plus, Search, MoreVertical, Trash2, Copy, Eye, EyeOff, Key } from 'lucide-react';
import { Dropdown, DropdownItem, DropdownSeparator } from '@/components/ui/Dropdown';
import { trpc } from '@/lib/trpc';

export default function AccessKeysPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [isGenerateDialogOpen, setIsGenerateDialogOpen] = useState(false);
  const [isSecretDialogOpen, setIsSecretDialogOpen] = useState(false);
  const [description, setDescription] = useState('');
  const [generatedKey, setGeneratedKey] = useState<{
    accessKeyId: string;
    secretAccessKey: string;
  } | null>(null);
  const [showSecret, setShowSecret] = useState(false);

  // Fetch access keys
  const { data: accessKeys, refetch } = trpc.accessKey.list.useQuery({
    includeInactive: true,
  });

  // Create access key mutation
  const createKeyMutation = trpc.accessKey.create.useMutation({
    onSuccess: (data) => {
      setGeneratedKey({
        accessKeyId: data.accessKey.accessKeyId,
        secretAccessKey: data.accessKey.secretAccessKey,
      });
      setIsGenerateDialogOpen(false);
      setIsSecretDialogOpen(true);
      setDescription('');
      refetch(); // Refresh the list
    },
  });

  // Delete access key mutation
  const deleteKeyMutation = trpc.accessKey.delete.useMutation({
    onSuccess: () => {
      refetch(); // Refresh the list
    },
  });

  const filteredKeys = accessKeys?.filter(
    (key) =>
      key.accessKeyId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (key.name?.toLowerCase() || '').includes(searchQuery.toLowerCase())
  ) || [];

  const handleGenerateKey = async () => {
    createKeyMutation.mutate({ name: description });
  };

  const handleDeleteKey = (id: string) => {
    if (confirm('Are you sure you want to delete this access key? This action cannot be undone.')) {
      deleteKeyMutation.mutate({ id });
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Access Keys</h1>
          <p className="mt-2 text-muted-foreground">
            Manage API access keys for S3 operations
          </p>
        </div>
        <Button onClick={() => setIsGenerateDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Generate New Key
        </Button>
      </div>

      {/* Info Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Key className="h-4 w-4" />
            About Access Keys
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Access keys consist of an access key ID and secret access key. Use them to make
            programmatic requests to the S3 API using AWS CLI, SDKs, or direct API calls.
            Keep your secret access keys secure and never share them publicly.
          </p>
        </CardContent>
      </Card>

      {/* Search Bar */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search access keys..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Access Keys Table */}
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Access Key ID</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Created</TableHead>
              <TableHead>Last Used</TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredKeys.map((key) => (
              <TableRow key={key.id}>
                <TableCell>
                  <code className="rounded bg-muted px-2 py-1 text-sm font-mono">
                    {key.accessKeyId}
                  </code>
                </TableCell>
                <TableCell className="font-medium">{key.name}</TableCell>
                <TableCell>
                  <Badge
                    variant={key.isActive ? 'success' : 'secondary'}
                    size="sm"
                  >
                    {key.isActive ? 'active' : 'inactive'}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {new Date(key.createdAt).toLocaleDateString()}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {key.lastUsedAt ? new Date(key.lastUsedAt).toLocaleDateString() : 'Never'}
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
                    <DropdownItem onClick={() => copyToClipboard(key.accessKeyId)}>
                      <Copy className="mr-2 h-4 w-4" />
                      <span>Copy Access Key ID</span>
                    </DropdownItem>
                    <DropdownSeparator />
                    <DropdownItem destructive onClick={() => handleDeleteKey(key.id)}>
                      <Trash2 className="mr-2 h-4 w-4" />
                      <span>Delete Key</span>
                    </DropdownItem>
                  </Dropdown>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Generate Key Dialog */}
      <Dialog open={isGenerateDialogOpen} onOpenChange={setIsGenerateDialogOpen}>
        <DialogHeader>
          <DialogTitle>Generate New Access Key</DialogTitle>
          <DialogDescription>
            Create a new access key pair for programmatic access
          </DialogDescription>
        </DialogHeader>
        <DialogContent>
          <Input
            label="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g., Production API Access"
            helperText="Add a description to help identify this key later"
            required
          />
        </DialogContent>
        <DialogFooter>
          <Button variant="outline" onClick={() => setIsGenerateDialogOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleGenerateKey} disabled={!description.trim()}>
            Generate Key
          </Button>
        </DialogFooter>
      </Dialog>

      {/* Show Secret Dialog */}
      <Dialog open={isSecretDialogOpen} onOpenChange={setIsSecretDialogOpen}>
        <DialogHeader>
          <DialogTitle>Access Key Created Successfully</DialogTitle>
          <DialogDescription>
            Save these credentials now. The secret key will only be shown once.
          </DialogDescription>
        </DialogHeader>
        <DialogContent>
          <Alert variant="warning">
            <AlertTitle>Important!</AlertTitle>
            <AlertDescription>
              This is the only time your secret access key will be displayed. Save it securely.
            </AlertDescription>
          </Alert>

          <div className="space-y-4 mt-4">
            <div>
              <label className="text-sm font-medium text-foreground">Access Key ID</label>
              <div className="mt-1.5 flex items-center gap-2">
                <code className="flex-1 rounded bg-muted px-3 py-2 text-sm font-mono">
                  {generatedKey?.accessKeyId}
                </code>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => copyToClipboard(generatedKey?.accessKeyId || '')}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-foreground">Secret Access Key</label>
              <div className="mt-1.5 flex items-center gap-2">
                <code className="flex-1 rounded bg-muted px-3 py-2 text-sm font-mono">
                  {showSecret
                    ? generatedKey?.secretAccessKey
                    : '••••••••••••••••••••••••••••••••'}
                </code>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setShowSecret(!showSecret)}
                >
                  {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => copyToClipboard(generatedKey?.secretAccessKey || '')}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
        <DialogFooter>
          <Button onClick={() => setIsSecretDialogOpen(false)}>Done</Button>
        </DialogFooter>
      </Dialog>
    </div>
  );
}
