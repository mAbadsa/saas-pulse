import { downMessage, formatDuration, recoveredMessage } from './messages';

describe('formatDuration', () => {
  it.each([
    [0, '0s'],
    [45_000, '45s'],
    [750_000, '12m 30s'],
    [11_100_000, '3h 5m'],
    [187_200_000, '2d 4h'],
  ])('%i ms -> %s', (ms, text) => expect(formatDuration(ms)).toBe(text));
});

describe('messages', () => {
  it('formats a down alert as plain text', () => {
    expect(
      downMessage({
        name: 'Shop *bold*',
        url: 'https://example.com',
        reason: 'HTTP 503',
        since: new Date('2026-09-28T14:03:10Z'),
      }),
    ).toBe(
      '🔴 DOWN: Shop *bold*\nhttps://example.com\nReason: HTTP 503\nFailing since 2026-09-28 14:03 UTC',
    );
  });

  it('formats a recovered alert with the downtime', () => {
    expect(
      recoveredMessage({
        name: 'Shop',
        url: 'https://x.io',
        downForMs: 750_000,
      }),
    ).toBe('🟢 RECOVERED: Shop\nhttps://x.io\nDown for 12m 30s');
  });
});
