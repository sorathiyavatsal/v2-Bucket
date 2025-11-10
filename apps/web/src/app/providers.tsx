'use client';

import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { trpc, getTRPCClient } from '@/lib/trpc';
import { AuthProvider } from '@/components/providers/AuthProvider';
import { S3Provider } from '@/components/providers/S3Provider';

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000, // 1 minute
        refetchOnWindowFocus: false,
      },
    },
  }));

  const [trpcClient] = useState(() => getTRPCClient());

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <S3Provider>
            {children}
          </S3Provider>
        </AuthProvider>
      </QueryClientProvider>
    </trpc.Provider>
  );
}
