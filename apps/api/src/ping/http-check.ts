import { lookup, type LookupAddress, type LookupOptions } from 'node:dns';
import http from 'node:http';
import https from 'node:https';
import { isIP } from 'node:net';
import { performance } from 'node:perf_hooks';
import { isBlockedAddress } from './blocked-addresses';

export interface CheckResult {
  isUp: boolean;
  statusCode: number | null;
  latencyMs: number | null;
  error: string | null;
}

const USER_AGENT = 'SaaSPulse/1.0 (+uptime monitor)';
const MAX_ERROR_LENGTH = 500;

type LookupCallback = (
  err: NodeJS.ErrnoException | null,
  address: string | LookupAddress[],
  family?: number,
) => void;

/**
 * DNS lookup used for the actual connection: rejects if ANY resolved address is non-public,
 * so the address we validate is the address we connect to (no DNS-rebinding gap).
 */
export function safeLookup(
  hostname: string,
  options: LookupOptions,
  callback: LookupCallback,
): void {
  lookup(hostname, { ...options, all: true }, (err, addresses) => {
    if (err) return callback(err, []);
    const bad = addresses.find((a) => isBlockedAddress(a.address));
    if (bad) return callback(new Error(`Blocked address ${bad.address}`), []);
    if (options.all) return callback(null, addresses);
    callback(null, addresses[0].address, addresses[0].family);
  });
}

const down = (error: string): CheckResult => ({
  isUp: false,
  statusCode: null,
  latencyMs: null,
  error: error.slice(0, MAX_ERROR_LENGTH),
});

/**
 * One GET to `url`. Never follows redirects, never reads the body, never rejects.
 * 2xx/3xx = up; 4xx/5xx, timeout, network or SSRF-block = down.
 */
export function checkUrl(
  url: string,
  { timeoutMs, allowPrivate }: { timeoutMs: number; allowPrivate: boolean },
): Promise<CheckResult> {
  const target = new URL(url);
  const host = target.hostname.replace(/^\[|\]$/g, '');
  // IP literals skip DNS lookup entirely, so check them up front.
  if (!allowPrivate && isIP(host) && isBlockedAddress(host)) {
    return Promise.resolve(down(`Blocked address ${host}`));
  }

  return new Promise((resolve) => {
    const start = performance.now();
    const client = target.protocol === 'https:' ? https : http;
    const req = client.request(target, {
      method: 'GET',
      headers: { 'User-Agent': USER_AGENT },
      lookup: allowPrivate ? undefined : safeLookup,
    });
    const timer = setTimeout(
      () => req.destroy(new Error(`Timed out after ${timeoutMs} ms`)),
      timeoutMs,
    );

    req.on('response', (res) => {
      clearTimeout(timer);
      res.resume(); // discard the body
      const statusCode = res.statusCode ?? 0;
      resolve({
        isUp: statusCode >= 200 && statusCode < 400,
        statusCode,
        latencyMs: Math.round(performance.now() - start),
        error: null,
      });
      req.destroy();
    });
    req.on('error', (err) => {
      clearTimeout(timer);
      resolve(down(err.message));
    });
    req.end();
  });
}
