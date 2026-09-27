import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { AuthResponse, MonitorResponse } from '@saas-pulse/shared';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/prisma/prisma.service';

describe('Monitors (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const run = Date.now();
  let tokenA: string;
  let tokenB: string;

  const http = () => request(app.getHttpServer());
  const as = (token: string) => ({ Authorization: `Bearer ${token}` });

  const register = async (label: string) => {
    const res = await http()
      .post('/auth/register')
      .send({
        email: `e2e-mon-${run}-${label}@example.com`,
        password: 's3cret-pass',
      })
      .expect(201);
    return (res.body as AuthResponse).accessToken;
  };

  const createMonitor = async (
    token: string,
    body: Record<string, unknown> = {},
  ) => {
    const res = await http()
      .post('/monitors')
      .set(as(token))
      .send({ name: 'Example', url: 'https://example.com', ...body })
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
    // Monitors and checks cascade from the users.
    await prisma.user.deleteMany({
      where: { email: { startsWith: `e2e-mon-${run}` } },
    });
    await app.close();
  });

  describe('POST /monitors (US1)', () => {
    it('creates a monitor with defaults and never exposes userId', async () => {
      const m = await createMonitor(tokenA, {
        name: '  Marketing site ',
        url: ' https://example.com ',
      });

      expect(m).toEqual({
        id: expect.any(String) as string,
        name: 'Marketing site',
        url: 'https://example.com',
        intervalSeconds: 60,
        isActive: true,
        status: 'PENDING',
        lastCheckedAt: null,
        createdAt: expect.any(String) as string,
        updatedAt: expect.any(String) as string,
      });
      expect(m).not.toHaveProperty('userId');
    });

    it('accepts localhost and a custom interval', async () => {
      const m = await createMonitor(tokenA, {
        url: 'http://localhost:3000/health',
        intervalSeconds: 300,
      });
      expect(m.intervalSeconds).toBe(300);
    });

    const ok = { name: 'x', url: 'https://example.com' };
    it.each([
      ['ftp url', { ...ok, url: 'ftp://example.com' }],
      ['javascript url', { ...ok, url: 'javascript:alert(1)' }],
      ['url without scheme', { ...ok, url: 'example.com' }],
      ['url with credentials', { ...ok, url: 'https://u:p@example.com' }],
      [
        'url over 2048 chars',
        { ...ok, url: `https://example.com/${'a'.repeat(2030)}` },
      ],
      ['empty name', { ...ok, name: '' }],
      ['whitespace name', { ...ok, name: '   ' }],
      ['name over 100 chars', { ...ok, name: 'n'.repeat(101) }],
      ['interval 29', { ...ok, intervalSeconds: 29 }],
      ['interval 86401', { ...ok, intervalSeconds: 86401 }],
      ['fractional interval', { ...ok, intervalSeconds: 60.5 }],
      ['userId field', { ...ok, userId: 'someone-else' }],
      ['status field', { ...ok, status: 'UP' }],
      ['id field', { ...ok, id: 'mine' }],
    ])('rejects %s with 400', (_label, body) =>
      http().post('/monitors').set(as(tokenA)).send(body).expect(400),
    );
  });

  describe('GET /monitors (US2)', () => {
    it('lists only my monitors, newest first', async () => {
      const token = await register('list');
      const first = await createMonitor(token, { name: 'first' });
      const second = await createMonitor(token, { name: 'second' });
      const third = await createMonitor(token, { name: 'third' });

      const res = await http().get('/monitors').set(as(token)).expect(200);
      expect((res.body as MonitorResponse[]).map((m) => m.id)).toEqual([
        third.id,
        second.id,
        first.id,
      ]);
    });

    it('returns [] for a user with no monitors', async () => {
      const token = await register('empty');
      const res = await http().get('/monitors').set(as(token)).expect(200);
      expect(res.body).toEqual([]);
    });

    it('gets one by id, and 404s for unknown or malformed ids', async () => {
      const m = await createMonitor(tokenA);
      const res = await http()
        .get(`/monitors/${m.id}`)
        .set(as(tokenA))
        .expect(200);
      expect((res.body as MonitorResponse).id).toBe(m.id);

      await http()
        .get('/monitors/cm0000000000000000000000')
        .set(as(tokenA))
        .expect(404);
      await http().get('/monitors/not-a-real-id').set(as(tokenA)).expect(404);
    });
  });

  describe('PATCH /monitors/:id (US3, US4)', () => {
    const patch = (id: string, body: object) =>
      http().patch(`/monitors/${id}`).set(as(tokenA)).send(body);

    it('changes only the given field', async () => {
      const m = await createMonitor(tokenA, { intervalSeconds: 120 });
      const res = await patch(m.id, { name: 'Renamed' }).expect(200);
      const updated = res.body as MonitorResponse;
      expect(updated.name).toBe('Renamed');
      expect(updated.url).toBe(m.url);
      expect(updated.intervalSeconds).toBe(120);
    });

    it('resets status only when the URL actually changes', async () => {
      const m = await createMonitor(tokenA);
      await prisma.monitor.update({
        where: { id: m.id },
        data: { status: 'UP', lastCheckedAt: new Date() },
      });

      const same = (
        await patch(m.id, { url: m.url, name: 'Same url' }).expect(200)
      ).body as MonitorResponse;
      expect(same.status).toBe('UP');
      expect(same.lastCheckedAt).not.toBeNull();

      const moved = (
        await patch(m.id, { url: 'https://example.org' }).expect(200)
      ).body as MonitorResponse;
      expect(moved.status).toBe('PENDING');
      expect(moved.lastCheckedAt).toBeNull();
    });

    it('rejects invalid and empty updates without changing anything', async () => {
      const m = await createMonitor(tokenA);
      await patch(m.id, { intervalSeconds: 5 }).expect(400);
      await patch(m.id, { status: 'UP' }).expect(400);
      const empty = await patch(m.id, {}).expect(400);
      expect(empty.body).toMatchObject({
        message: 'At least one field must be provided',
      });

      const res = await http().get(`/monitors/${m.id}`).set(as(tokenA));
      expect((res.body as MonitorResponse).intervalSeconds).toBe(60);
    });

    it('pauses (keeping the last status) and resumes idempotently', async () => {
      const m = await createMonitor(tokenA);
      await prisma.monitor.update({
        where: { id: m.id },
        data: { status: 'UP' },
      });

      for (let i = 0; i < 2; i++) {
        const paused = (await patch(m.id, { isActive: false }).expect(200))
          .body as MonitorResponse;
        expect(paused.isActive).toBe(false);
        expect(paused.status).toBe('UP');
      }
      const resumed = (await patch(m.id, { isActive: true }).expect(200))
        .body as MonitorResponse;
      expect(resumed.isActive).toBe(true);
    });
  });

  describe('DELETE /monitors/:id (US5)', () => {
    it('deletes the monitor and all its checks', async () => {
      const m = await createMonitor(tokenA);
      await prisma.check.createMany({
        data: [
          { monitorId: m.id, isUp: true, statusCode: 200, latencyMs: 40 },
          { monitorId: m.id, isUp: false, error: 'timeout' },
        ],
      });

      await http().delete(`/monitors/${m.id}`).set(as(tokenA)).expect(204);
      expect(await prisma.check.count({ where: { monitorId: m.id } })).toBe(0);
      await http().get(`/monitors/${m.id}`).set(as(tokenA)).expect(404);
      await http().delete(`/monitors/${m.id}`).set(as(tokenA)).expect(404);
    });
  });

  describe('isolation (US6)', () => {
    it("never lets user B see or touch user A's monitor", async () => {
      const m = await createMonitor(tokenA, { name: 'A private' });

      const list = await http().get('/monitors').set(as(tokenB)).expect(200);
      expect((list.body as MonitorResponse[]).map((x) => x.id)).not.toContain(
        m.id,
      );

      // Build each request lazily: supertest binds the server per request.
      const attempts = [
        () => http().get(`/monitors/${m.id}`).set(as(tokenB)),
        () =>
          http()
            .patch(`/monitors/${m.id}`)
            .set(as(tokenB))
            .send({ name: 'pwned' }),
        () =>
          http()
            .patch(`/monitors/${m.id}`)
            .set(as(tokenB))
            .send({ isActive: false }),
        () => http().delete(`/monitors/${m.id}`).set(as(tokenB)),
      ];
      for (const attempt of attempts) {
        const res = await attempt().expect(404);
        expect(res.body).toMatchObject({ message: 'Monitor not found' });
      }

      const after = await http()
        .get(`/monitors/${m.id}`)
        .set(as(tokenA))
        .expect(200);
      expect(after.body).toEqual(m);
    });

    it('requires a token on every monitors route', async () => {
      await http().post('/monitors').send({}).expect(401);
      await http().get('/monitors').expect(401);
      await http().get('/monitors/x').expect(401);
      await http().patch('/monitors/x').send({}).expect(401);
      await http().delete('/monitors/x').expect(401);
    });
  });
});
