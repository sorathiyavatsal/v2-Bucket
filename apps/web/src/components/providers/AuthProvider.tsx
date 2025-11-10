'use client';

import { createContext, useContext, ReactNode } from 'react';
import { useSession } from '@/lib/auth-client';

interface User {
  id: string;
  email: string;
  name: string | null;
  isAdmin: boolean;
  image: string | null;
}

interface Session {
  user: User;
  session: {
    id: string;
    expiresAt: Date;
  };
}

interface AuthContextType {
  session: Session | null;
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { data: session, isPending } = useSession();

  const value: AuthContextType = {
    session: session as Session | null,
    user: session?.user as User | null,
    isLoading: isPending,
    isAuthenticated: !!session?.user,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
