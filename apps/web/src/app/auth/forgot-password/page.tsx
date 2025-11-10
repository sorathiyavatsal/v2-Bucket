'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Alert, AlertDescription } from '@/components/ui/Alert';
import { Database, ArrowLeft } from 'lucide-react';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const validateForm = () => {
    if (!email.trim()) {
      setError('Email is required');
      return false;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Invalid email format');
      return false;
    }

    setError('');
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsLoading(true);

    try {
      const { forgetPassword } = await import('@/lib/auth-client');

      await forgetPassword({
        email,
        redirectTo: '/auth/reset-password',
      }, {
        onSuccess: () => {
          setIsSuccess(true);
        },
        onError: (ctx) => {
          setError(ctx.error.message || 'Failed to send reset email');
        },
      });
    } catch (error: any) {
      setError(error.message || 'Failed to send reset email. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <div className="flex min-h-screen flex-col items-center justify-center p-4">
        <div className="w-full max-w-md">
          {/* Logo and Title */}
          <div className="mb-8 text-center">
            <div className="mb-4 flex justify-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg">
                <Database className="h-10 w-10" />
              </div>
            </div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Reset Password
            </h1>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              Enter your email to receive a password reset link
            </p>
          </div>

          {/* Forgot Password Card */}
          <div className="rounded-lg bg-white p-8 shadow-xl dark:bg-gray-800">
            {isSuccess ? (
              <div className="space-y-6">
                <Alert variant="success">
                  <AlertDescription>
                    Password reset link has been sent to your email. Please check your inbox.
                  </AlertDescription>
                </Alert>

                <div className="text-center text-sm text-gray-600 dark:text-gray-400">
                  <p>Didn't receive the email?</p>
                  <button
                    onClick={() => setIsSuccess(false)}
                    className="mt-2 font-medium text-primary hover:text-primary/80"
                  >
                    Try again
                  </button>
                </div>

                <Link href="/">
                  <Button variant="outline" className="w-full">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back to Sign In
                  </Button>
                </Link>
              </div>
            ) : (
              <>
                {error && (
                  <Alert variant="error" className="mb-6">
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                  <Input
                    label="Email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    helperText="We'll send you a reset link"
                    required
                  />

                  <Button
                    type="submit"
                    className="w-full"
                    disabled={isLoading}
                  >
                    {isLoading ? 'Sending...' : 'Send Reset Link'}
                  </Button>
                </form>

                <div className="mt-6 text-center">
                  <Link href="/">
                    <Button variant="ghost" className="w-full">
                      <ArrowLeft className="mr-2 h-4 w-4" />
                      Back to Sign In
                    </Button>
                  </Link>
                </div>
              </>
            )}
          </div>

          {/* Footer */}
          <p className="mt-8 text-center text-xs text-gray-500 dark:text-gray-400">
            © 2025 V2-Bucket Platform. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
}
