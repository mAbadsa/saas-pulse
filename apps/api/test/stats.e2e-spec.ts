import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type {
  AuthResponse,
  MonitorResponse,
  MonitorStatsDetail,
  MonitorStatsSummary,
} from '@saas-pulse/shared';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { CheckRetentionService } from './../src/ping/check-retention.service';
import { PrismaService } from './../src/prisma/prisma.service';

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

describe('Stats (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const run = Date.now();
  let tokenA: string;
  let tokenB: string;

  const http = () => request(app.getHttpServer());
  const as = (token: string) => ({ Authorization: `Bearer ${token}` });
  const ago = (ms: number) => new Date(Date.now() - ms);

  const register = async (label: string) => {
    const res = await http()
      .post('/auth/register')
      .send({
        email: `e2e-stats-${run}-${label}@example.com`,
        password: 's3cret-pass',
      })
      .expect(201);
    return (res.body as AuthResponse).accessToken;
  };
  const createMonitor = async (token: string, name = 'M') => {
    const res = await http()
      .post('/monitors')
      .set(as(token))
      .send({ name, url: 'https://example.com' })
      .expect(201);
    return res.body as MonitorResponse;
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);
    tokenA = await register('a');
    tokenB = await register('b');
  });

  afterAll(async () => {
    await prisma.user.deleteMany({
      where: { email: { startsWith: `e2e-stats-${run}` } },
    });
    await app.close();
  });

  describe('figures (US1, US2)', () => {
    let m: MonitorResponse;
    let empty: MonitorResponse;

    beforeAll(async () => {
      m = await createMonitor(tokenA, 'with checks');
      empty = await createMonitor(tokenA, 'no checks');
      await prisma.check.createMany({
        data: [
          {
            monitorId: m.id,
            isUp: true,
            statusCode: 200,
            latencyMs: 100,
            checkedAt: ago(5 * HOUR),
          },
          {
            monitorId: m.id,
            isUp: true,
            statusCode: 200,
            latencyMs: 200,
            checkedAt: ago(3 * HOUR),
          },
          {
            monitorId: m.id,
            isUp: true,
            statusCode: 200,
            latencyMs: 300,
            checkedAt: ago(1 * HOUR),
          },
          {
            monitorId: m.id,
            isUp: false,
            error: 'Timed out after 10000 ms',
            checkedAt: ago(10 * MIN),
          },
          // Outside 24h, inside 7d:
          {
            monitorId: m.id,
            isUp: false,
            statusCode: 500,
            latencyMs: 900,
            checkedAt: ago(3 * DAY),
          },
        ],
      });
    });

    it('summarises the last 24h per monitor (null when no data)', async () => {
      const res = await http()
        .get('/monitors/stats')
        .set(as(tokenA))
        .expect(200);
      const byId = new Map(
        (res.body as MonitorStatsSummary[]).map((s) => [s.monitorId, s]),
      );
      expect(byId.get(m.id)).toEqual({
        monitorId: m.id,
        checks: 4,
        uptimePercent: 75,
        avgLatencyMs: 200, // the timed-out check has no latency and is excluded
      });
      expect(byId.get(empty.id)).toEqual({
        monitorId: empty.id,
        checks: 0,
        uptimePercent: null,
        avgLatencyMs: null,
      });
    });

    it('returns a 24h hourly series with gaps and recent checks', async () => {
      const res = await http()
        .get(`/monitors/${m.id}/stats`)
        .set(as(tokenA))
        .expect(200);
      const d = res.body as MonitorStatsDetail;

      expect(d).toMatchObject({
        range: '24h',
        bucketSeconds: 3600,
        checks: 4,
        uptimePercent: 75,
        avgLatencyMs: 200,
      });
      expect(d.series.length).toBeGreaterThanOrEqual(24);
      expect(d.series.length).toBeLessThanOrEqual(25);
      expect(d.series.reduce((n, p) => n + p.checks, 0)).toBe(4);
      const empties = d.series.filter((p) => p.checks === 0);
      expect(empties.length).toBeGreaterThan(0);
      expect(
        empties.every(
          (p) => p.avgLatencyMs === null && p.uptimePercent === null,
        ),
      ).toBe(true);
      // Oldest first.
      expect(new Date(d.series[0].t) < new Date(d.series.at(-1)!.t)).toBe(true);

      expect(d.recent).toHaveLength(5);
      expect(d.recent[0]).toMatchObject({
        isUp: false,
        error: 'Timed out after 10000 ms',
      });
      expect(
        new Date(d.recent[0].checkedAt) > new Date(d.recent[1].checkedAt),
      ).toBe(true);
    });

    it('widens to 7 days with 6-hour slots', async () => {
      const res = await http()
        .get(`/monitors/${m.id}/stats?range=7d`)
        .set(as(tokenA))
        .expect(200);
      const d = res.body as MonitorStatsDetail;
      expect(d).toMatchObject({
        range: '7d',
        bucketSeconds: 21600,
        checks: 5,
        uptimePercent: 60,
        avgLatencyMs: 375, // (100 + 200 + 300 + 900) / 4
      });
      expect(d.series.length).toBeGreaterThanOrEqual(28);
      expect(d.series.length).toBeLessThanOrEqual(29);
    });

    it('rejects unknown ranges', () =>
      http()
        .get(`/monitors/${m.id}/stats?range=30d`)
        .set(as(tokenA))
        .expect(400));

    it("never exposes another user's stats", async () => {
      const res = await http()
        .get(`/monitors/${m.id}/stats`)
        .set(as(tokenB))
        .expect(404);
      expect(res.body).toMatchObject({ message: 'Monitor not found' });

      const summary = await http()
        .get('/monitors/stats')
        .set(as(tokenB))
        .expect(200);
      expect(
        (summary.body as MonitorStatsSummary[]).map((s) => s.monitorId),
      ).not.toContain(m.id);

      await http()
        .get('/monitors/not-a-real-id/stats')
        .set(as(tokenA))
        .expect(404);
    });
  });

  describe('retention (US3)', () => {
    it('deletes checks older than 30 days and keeps newer ones', async () => {
      const m = await createMonitor(tokenA, 'retention');
      await prisma.check.createMany({
        data: [
          {
            monitorId: m.id,
            isUp: true,
            latencyMs: 1,
            checkedAt: ago(31 * DAY),
          },
          {
            monitorId: m.id,
            isUp: true,
            latencyMs: 1,
            checkedAt: ago(29 * DAY),
          },
        ],
      });

      await app.get(CheckRetentionService).prune();

      const left = await prisma.check.findMany({ where: { monitorId: m.id } });
      expect(left).toHaveLength(1);
      expect(left[0].checkedAt.getTime()).toBeGreaterThan(
        ago(30 * DAY).getTime(),
      );
    });
  });

  describe('performance (SC-003)', () => {
    it('serves 7 days of 30-second checks (~20k rows) in under 1 s', async () => {
      const m = await createMonitor(tokenA, 'busy');
      const rows = Array.from({ length: 20_160 }, (_, i) => ({
        monitorId: m.id,
        isUp: i % 50 !== 0,
        statusCode: 200,
        latencyMs: 50 + (i % 200),
        checkedAt: ago(i * 30_000),
      }));
      await prisma.check.createMany({ data: rows });

      const timed = async () => {
        const start = Date.now();
        const res = await http()
          .get(`/monitors/${m.id}/stats?range=7d`)
          .set(as(tokenA))
          .expect(200);
        return { res, ms: Date.now() - start };
      };
      // Assert steady state (3rd call): the first can land while Postgres is still
      // absorbing the 20k-row bulk insert above.
      const runs = [await timed(), await timed(), await timed()];

      expect((runs[2].res.body as MonitorStatsDetail).checks).toBeGreaterThan(
        20_000,
      );
      expect(runs[2].ms).toBeLessThan(1000);
    }, 60_000);
  });
});
