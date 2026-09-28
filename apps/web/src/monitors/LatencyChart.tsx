import type { StatsPoint, StatsRange } from '@saas-pulse/shared';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from 'recharts';
import { formatLatency, formatUptime } from '@/lib/format';

const AXIS_FORMAT: Record<StatsRange, Intl.DateTimeFormatOptions> = {
  '24h': { hour: '2-digit', minute: '2-digit' },
  '7d': { weekday: 'short', hour: '2-digit' },
};
const TOOLTIP_FORMAT: Intl.DateTimeFormatOptions = {
  weekday: 'short',
  hour: '2-digit',
  minute: '2-digit',
};

const fmt = (iso: string, opts: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat(undefined, opts).format(new Date(iso));

/** Values lead, labels follow; text in text tokens, never the series colour. */
function ChartTooltip({ active, payload }: TooltipContentProps) {
  const point = payload?.[0]?.payload as StatsPoint | undefined;
  if (!active || !point) return null;
  return (
    <div className="bg-popover text-popover-foreground rounded-md border px-3 py-2 text-xs shadow-sm">
      <p className="text-muted-foreground mb-1">{fmt(point.t, TOOLTIP_FORMAT)}</p>
      {point.checks === 0 ? (
        <p>No checks in this period</p>
      ) : (
        <dl className="grid grid-cols-[auto_auto] gap-x-3 gap-y-0.5">
          <dd className="font-semibold tabular-nums">{formatLatency(point.avgLatencyMs)}</dd>
          <dt className="text-muted-foreground">avg latency</dt>
          <dd className="font-semibold tabular-nums">{formatUptime(point.uptimePercent)}</dd>
          <dt className="text-muted-foreground">uptime</dt>
          <dd className="font-semibold tabular-nums">{point.checks}</dd>
          <dt className="text-muted-foreground">checks</dt>
        </dl>
      )}
    </div>
  );
}

/**
 * Single-series latency line (dataviz: one measure over time, no legend - the title names it).
 * Colour is --chart-1 (validated blue, light/dark). Empty slots are gaps, not zero.
 */
export function LatencyChart({
  series,
  range,
  summary,
}: {
  series: StatsPoint[];
  range: StatsRange;
  summary: string;
}) {
  return (
    <div role="img" aria-label={summary} className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={series} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--color-border)" strokeWidth={1} />
          <XAxis
            dataKey="t"
            tickFormatter={(t: string) => fmt(t, AXIS_FORMAT[range])}
            tick={{ fill: 'var(--color-muted-foreground)', fontSize: 12 }}
            tickLine={false}
            axisLine={{ stroke: 'var(--color-border)' }}
            minTickGap={24}
          />
          <YAxis
            unit=" ms"
            domain={[0, 'auto']}
            allowDecimals={false}
            tick={{ fill: 'var(--color-muted-foreground)', fontSize: 12 }}
            tickLine={false}
            axisLine={false}
            width={64}
          />
          <Tooltip
            content={ChartTooltip}
            cursor={{ stroke: 'var(--color-muted-foreground)', strokeWidth: 1 }}
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="avgLatencyMs"
            stroke="var(--color-chart-1)"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            dot={false}
            activeDot={{ r: 4, strokeWidth: 2, stroke: 'var(--color-card)' }}
            connectNulls={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
