import type { AuthResponse, UserProfile } from '@saas-pulse/shared';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { setUnauthorizedHandler } from '@/lib/api';
import { clearSession, loadSession, saveSession } from '@/lib/session';
import { AuthContext } from './auth-context';

export function AuthProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const [user, setUser] = useState<UserProfile | null>(
    () => loadSession()?.user ?? null,
  );

  const signIn = useCallback((res: AuthResponse) => {
    saveSession(res);
    setUser(res.user);
  }, []);

  const signOut = useCallback(
    (reason?: 'expired') => {
      clearSession();
      setUser(null);
      void navigate('/login', { replace: true, state: { reason } });
    },
    [navigate],
  );

  useEffect(() => {
    setUnauthorizedHandler(() => signOut('expired'));
  }, [signOut]);

  const value = useMemo(
    () => ({ user, signIn, signOut }),
    [user, signIn, signOut],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
