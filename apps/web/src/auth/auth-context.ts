import type { AuthResponse, UserProfile } from '@saas-pulse/shared';
import { createContext, useContext } from 'react';

export interface AuthContextValue {
  user: UserProfile | null;
  signIn: (res: AuthResponse) => void;
  signOut: (reason?: 'expired') => void;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
