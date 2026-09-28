const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['day', 86_400],
  ['hour', 3_600],
  ['minute', 60],
  ['second', 1],
];

/** "Never", "just now", "2 minutes ago", ... */
export function relativeTime(iso: string | null): string {
  if (!iso) return 'Never';
  const seconds = Math.round((new Date(iso).getTime() - Date.now()) / 1000);
  if (Math.abs(seconds) < 10) return 'just now';
  const [unit, size] = UNITS.find(([, s]) => Math.abs(seconds) >= s)!;
  return rtf.format(Math.round(seconds / size), unit);
}
