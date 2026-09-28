import type { ApiErrorResponse } from '@saas-pulse/shared';
import { loadSession } from './session';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

export class ApiError extends Error {
  readonly status: number;
  readonly messages: string[];

  constructor(status: number, messages: string[]) {
    super(messages.join(', '));
    this.status = status;
    this.messages = messages;
  }
}

let onUnauthorized: () => void = () => {};

/** Called when an authenticated request gets 401 (expired or invalid session). */
export function setUnauthorizedHandler(handler: () => void): void {
  onUnauthorized = handler;
}

export async function api<T = void>(
  path: string,
  { method = 'GET', body }: { method?: string; body?: unknown } = {},
): Promise<T> {
  const token = loadSession()?.accessToken;
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method,
      headers: {
        ...(body !== undefined && { 'Content-Type': 'application/json' }),
        ...(token && { Authorization: `Bearer ${token}` }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, ['Cannot reach the server. Check your connection.']);
  }

  if (res.status === 204) return undefined as T;
  if (res.ok) return (await res.json()) as T;

  // On /auth/* a 401 means wrong credentials, not an expired session.
  if (res.status === 401 && !path.startsWith('/auth/')) onUnauthorized();

  const data = (await res.json().catch(() => null)) as ApiErrorResponse | null;
  const raw: unknown = data?.message;
  const messages = Array.isArray(raw)
    ? raw.map(String)
    : [typeof raw === 'string' ? raw : `Request failed (${res.status})`];
  throw new ApiError(res.status, messages);
}
