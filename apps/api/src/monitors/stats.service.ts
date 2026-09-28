import { Injectable, NotFoundException } from '@nestjs/common';
import type {
  MonitorStatsDetail,
  MonitorStatsSummary,
  StatsPoint,
  StatsRange,
} from '@saas-pulse/shared';
import { PrismaService } from '../prisma/prisma.service';

const HOUR_MS = 3_600_000;

// Fixed map: `step` is bound as an interval parameter, never interpolated into SQL.
const RANGES: Record<
  StatsRange,
  { spanMs: number; stepMs: number; step: string; bucketSeconds: number }
> = {
  '24h': {
    spanMs: 24 * HOUR_MS,
    stepMs: HOUR_MS,
    step: '1 hour',
    bucketSeconds: 3600,
  },
  '7d': {
    spanMs: 168 * HOUR_MS,
    stepMs: 6 * HOUR_MS,
    step: '6 hours',
    bucketSeconds: 21600,
  },
};

const RECENT_LIMIT = 20;

interface Bucket {
  t: Date;
  checks: number;
  up: number;
  latencySum: number;
  latencyCount: number;
}

/** Uptime % (1 dp) and mean latency over some buckets; null when there's no data. */
function figures(buckets: (Bucket | undefined)[]) {
  let checks = 0;
  let up = 0;
  let latencySum = 0;
  let latencyCount = 0;
  for (const b of buckets) {
    if (!b) continue;
    checks += b.checks;
    up += b.up;
    latencySum += b.latencySum;
    latencyCount += b.latencyCount;
  }
  return {
    checks,
    uptimePercent: checks ? Math.round((1000 * up) / checks) / 10 : null,
    avgLatencyMs: latencyCount ? Math.round(latencySum / latencyCount) : null,
  };
}

/**
 * Uptime/latency computed on read from Check rows (uses the (monitorId, checkedAt) index).
 * Every query is scoped by userId. avg() skips null latencies (no-response failures).
 */
// ponytail: computed on every request; add hourly rollups if stats queries get slow at scale
@Injectable()
export class StatsService {
  constructor(private readonly prisma: PrismaService) {}

  /** 24 h summary for every monitor the user owns. */
  summaryForUser(userId: string): Promise<MonitorStatsSummary[]> {
    return this.prisma.$queryRaw<MonitorStatsSummary[]>`
      SELECT m.id AS "monitorId",
             count(c.id)::int AS checks,
             round(100.0 * count(c.id) FILTER (WHERE c."isUp")
                   / NULLIF(count(c.id), 0), 1)::float AS "uptimePercent",
             round(avg(c."latencyMs"))::int AS "avgLatencyMs"
      FROM "Monitor" m
      LEFT JOIN "Check" c
        ON c."monitorId" = m.id AND c."checkedAt" >= now() - interval '24 hours'
      WHERE m."userId" = ${userId}
      GROUP BY m.id`;
  }

  async detail(
    id: string,
    userId: string,
    range: StatsRange,
  ): Promise<MonitorStatsDetail> {
    const owned = await this.prisma.monitor.findFirst({
      where: { id, userId },
      select: { id: true },
    });
    if (!owned) throw new NotFoundException('Monitor not found');

    const { spanMs, stepMs, step, bucketSeconds } = RANGES[range];
    const now = Date.now();
    const since = new Date(now - spanMs);

    // One index range scan, grouped into epoch-aligned slots; raw sums so the
    // period totals and empty slots are derived below without another query.
    const [buckets, recent] = await Promise.all([
      this.prisma.$queryRaw<Bucket[]>`
        SELECT date_bin(${step}::interval, "checkedAt", 'epoch') AS t,
               count(*)::int AS checks,
               (count(*) FILTER (WHERE "isUp"))::int AS up,
               coalesce(sum("latencyMs"), 0)::float AS "latencySum",
               count("latencyMs")::int AS "latencyCount"
        FROM "Check"
        WHERE "monitorId" = ${id} AND "checkedAt" >= ${since}
        GROUP BY 1`,
      this.prisma.check.findMany({
        where: { monitorId: id },
        orderBy: { checkedAt: 'desc' },
        take: RECENT_LIMIT,
        select: {
          id: true,
          checkedAt: true,
          isUp: true,
          statusCode: true,
          latencyMs: true,
          error: true,
        },
      }),
    ]);

    const byStart = new Map(buckets.map((b) => [b.t.getTime(), b]));
    const series: StatsPoint[] = [];
    for (
      let t = Math.floor((now - spanMs) / stepMs) * stepMs;
      t <= now;
      t += stepMs
    ) {
      series.push({
        t: new Date(t).toISOString(),
        ...figures([byStart.get(t)]),
      });
    }

    return {
      monitorId: id,
      range,
      bucketSeconds,
      ...figures(buckets),
      series,
      recent: recent.map((c) => ({
        ...c,
        checkedAt: c.checkedAt.toISOString(),
      })),
    };
  }
}
