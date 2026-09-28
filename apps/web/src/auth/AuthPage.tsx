import type { AuthResponse } from '@saas-pulse/shared';
import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { FormError } from '@/components/form-error';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { api, ApiError } from '@/lib/api';
import { useAuth } from './auth-context';

export function AuthPage({ mode }: { mode: 'login' | 'register' }) {
  const isLogin = mode === 'login';
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const expired =
    (useLocation().state as { reason?: string } | null)?.reason === 'expired';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [errors, setErrors] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setErrors([]);
    try {
      const res = await api<AuthResponse>(
        isLogin ? '/auth/login' : '/auth/register',
        {
          method: 'POST',
          body: isLogin
            ? { email, password }
            : { email, password, ...(name.trim() && { name: name.trim() }) },
        },
      );
      signIn(res);
      void navigate('/', { replace: true });
    } catch (err) {
      const apiErr = err instanceof ApiError ? err : null;
      setErrors(apiErr?.messages ?? ['Something went wrong. Please try again.']);
      if (isLogin && apiErr?.status === 401) setPassword('');
      setSubmitting(false);
    }
  };

  return (
    <main className="flex min-h-svh items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-xl">
            {isLogin ? 'Sign in to SaaS Pulse' : 'Create your account'}
          </CardTitle>
          <CardDescription>
            {isLogin
              ? 'Monitor your sites and APIs.'
              : 'Start monitoring in under a minute.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="flex flex-col gap-4">
            {expired && isLogin && errors.length === 0 && (
              <p role="status" className="text-muted-foreground rounded-md border p-3 text-sm">
                Your session expired, please sign in again.
              </p>
            )}
            <FormError messages={errors} />

            {!isLogin && (
              <div className="flex flex-col gap-2">
                <Label htmlFor="name">Name (optional)</Label>
                <Input
                  id="name"
                  autoComplete="name"
                  maxLength={100}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
            )}
            <div className="flex flex-col gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete={isLogin ? 'current-password' : 'new-password'}
                required
                minLength={isLogin ? undefined : 8}
                aria-describedby={isLogin ? undefined : 'password-help'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              {!isLogin && (
                <p id="password-help" className="text-muted-foreground text-xs">
                  At least 8 characters.
                </p>
              )}
            </div>

            <Button type="submit" disabled={submitting}>
              {submitting
                ? isLogin
                  ? 'Signing in…'
                  : 'Creating account…'
                : isLogin
                  ? 'Sign in'
                  : 'Create account'}
            </Button>
          </form>

          <p className="text-muted-foreground mt-4 text-center text-sm">
            {isLogin ? 'New to SaaS Pulse? ' : 'Already have an account? '}
            <Link
              to={isLogin ? '/register' : '/login'}
              className="text-foreground underline underline-offset-4"
            >
              {isLogin ? 'Create an account' : 'Sign in'}
            </Link>
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
