// Plain text only (sent without parse_mode), so monitor names can't inject formatting.

export function formatDuration(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  const d = Math.floor(s / 86_400);
  const h = Math.floor((s % 86_400) / 3_600);
  const m = Math.floor((s % 3_600) / 60);
  if (d) return `${d}d ${h}h`;
  if (h) return `${h}h ${m}m`;
  if (m) return `${m}m ${s % 60}s`;
  return `${s}s`;
}

const utcTime = (date: Date) =>
  `${date.toISOString().slice(0, 16).replace('T', ' ')} UTC`;

export function downMessage(p: {
  name: string;
  url: string;
  reason: string;
  since: Date;
}): string {
  return [
    `🔴 DOWN: ${p.name}`,
    p.url,
    `Reason: ${p.reason}`,
    `Failing since ${utcTime(p.since)}`,
  ].join('\n');
}

export function recoveredMessage(p: {
  name: string;
  url: string;
  downForMs: number;
}): string {
  return [
    `🟢 RECOVERED: ${p.name}`,
    p.url,
    `Down for ${formatDuration(p.downForMs)}`,
  ].join('\n');
}

export const CONNECTED_TEXT =
  "✅ Connected to SaaS Pulse. You'll get a message here when a monitor goes down or recovers.";
export const EXPIRED_TEXT =
  'This link has expired. Open SaaS Pulse → Settings → Connect Telegram to get a new one.';
export const HELP_TEXT =
  'To get alerts, open SaaS Pulse → Settings → Connect Telegram.';
export const TEST_TEXT =
  '🔔 Test alert from SaaS Pulse. Alerts for your monitors will arrive here.';
