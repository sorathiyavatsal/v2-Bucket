'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Alert, AlertDescription } from '@/components/ui/Alert';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { Key, AlertCircle, CheckCircle } from 'lucide-react';
import { useS3 } from '@/components/providers/S3Provider';
import { trpc } from '@/lib/trpc';
import Link from 'next/link';

export function S3CredentialsSetup() {
  const { setCredentials, isConfigured, accessKeyId, clearCredentials } = useS3();
  const [showForm, setShowForm] = useState(!isConfigured);
  const [formData, setFormData] = useState({
    accessKeyId: '',
    secretAccessKey: '',
  });
  const [error, setError] = useState('');

  // Query access keys to show available keys
  const { data: accessKeys } = trpc.accessKey.list.useQuery(
    { includeInactive: false },
    { enabled: !isConfigured }
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!formData.accessKeyId || !formData.secretAccessKey) {
      setError('Both Access Key ID and Secret Access Key are required');
      return;
    }

    try {
      setCredentials(formData.accessKeyId, formData.secretAccessKey);
      setShowForm(false);
      setFormData({ accessKeyId: '', secretAccessKey: '' });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to configure credentials');
    }
  };

  const handleClearCredentials = () => {
    if (confirm('Are you sure you want to clear the stored credentials?')) {
      clearCredentials();
      setShowForm(true);
    }
  };

  if (isConfigured && !showForm) {
    return (
      <Alert variant="success" className="mb-6">
        <CheckCircle className="h-4 w-4" />
        <AlertDescription className="flex items-center justify-between w-full">
          <span>
            S3 Credentials configured (Access Key: {accessKeyId?.substring(0, 10)}...)
          </span>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowForm(true)}
            >
              Change
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleClearCredentials}
            >
              Clear
            </Button>
          </div>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Key className="h-5 w-5" />
          Configure S3 Access
        </CardTitle>
        <CardDescription>
          Enter your access key credentials to manage objects. Don't have an access key?{' '}
          <Link href="/app/access-keys" className="text-primary hover:underline">
            Create one here
          </Link>
        </CardDescription>
      </CardHeader>
      <CardContent>
        {accessKeys && accessKeys.length > 0 && (
          <Alert className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              You have {accessKeys.length} active access key{accessKeys.length !== 1 ? 's' : ''}.
              Use any of your keys below.
            </AlertDescription>
          </Alert>
        )}

        {error && (
          <Alert variant="error" className="mb-4">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Access Key ID"
            value={formData.accessKeyId}
            onChange={(e) => setFormData({ ...formData, accessKeyId: e.target.value })}
            placeholder="AKIA..."
            required
          />

          <Input
            label="Secret Access Key"
            type="password"
            value={formData.secretAccessKey}
            onChange={(e) => setFormData({ ...formData, secretAccessKey: e.target.value })}
            placeholder="Enter your secret key"
            helperText="Your credentials are stored locally and never sent to our servers"
            required
          />

          <div className="flex gap-2">
            <Button type="submit">
              Configure Access
            </Button>
            {isConfigured && (
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowForm(false)}
              >
                Cancel
              </Button>
            )}
          </div>
        </form>

        {accessKeys && accessKeys.length > 0 && (
          <div className="mt-4 pt-4 border-t">
            <p className="text-sm font-medium mb-2">Your Access Keys:</p>
            <div className="space-y-2">
              {accessKeys.map((key) => (
                <div
                  key={key.id}
                  className="flex items-center justify-between p-2 bg-secondary rounded-md"
                >
                  <div className="text-sm">
                    <span className="font-mono">{key.accessKeyId}</span>
                    <p className="text-xs text-muted-foreground">{key.name}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
