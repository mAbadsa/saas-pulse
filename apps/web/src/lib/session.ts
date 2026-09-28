import type { AuthResponse } from '@saas-pulse/shared';

// ponytail: token in localStorage is readable by injected scripts (XSS); move to an
// httpOnly cookie session (needs API changes + CSRF protection) before public deployment.
const KEY = 'saas-pulse.session';

export type Session = AuthResponse;

export function loadSession(): Session | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

export function saveSession(session: Session): void {
  localStorage.setItem(KEY, JSON.stringify(session));
}

export function clearSession(): void {
  localStorage.removeItem(KEY);
}
