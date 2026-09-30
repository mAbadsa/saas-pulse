import { randomBytes } from 'node:crypto';

export const LINK_TTL_MS = 10 * 60 * 1000;

/**
 * Single-use, short-lived codes that tie a Telegram /start to a user.
 * 18 random bytes -> 24 base64url chars (fits Telegram's start-parameter alphabet).
 */
// ponytail: in-memory, so a restart drops pending links and instances don't share them; move to Redis with TTL for multi-instance
export class LinkCodes {
  private readonly codes = new Map<
    string,
    { userId: string; expiresAt: number }
  >();

  issue(userId: string, now = Date.now()): { code: string; expiresAt: Date } {
    for (const [code, entry] of this.codes) {
      if (entry.expiresAt <= now) this.codes.delete(code);
    }
    const code = randomBytes(18).toString('base64url');
    const expiresAt = now + LINK_TTL_MS;
    this.codes.set(code, { userId, expiresAt });
    return { code, expiresAt: new Date(expiresAt) };
  }

  /** The user id if the code is valid; consumes it either way. */
  redeem(code: string, now = Date.now()): string | null {
    const entry = this.codes.get(code);
    this.codes.delete(code);
    return entry && entry.expiresAt > now ? entry.userId : null;
  }
}
