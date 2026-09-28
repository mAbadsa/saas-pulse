import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { AppModule } from './../src/app.module';
import { checkUrl } from './../src/ping/http-check';
import { PingService } from './../src/ping/ping.service';
import { PrismaService } from './../src/prisma/prisma.service';

describe('Ping service (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let ping: PingService;
  let server: http.Server;
  let base: string;
  let closedPortUrl: string;
  let hits = 0;
  let userId: string;
  const run = Date.now();

  beforeAll(async () => {
    process.env.PING_ALLOW_PRIVATE = 'true';
    process.env.PING_TIMEOUT_MS = '2000';

    server = http.createServer((req, res) => {
      hits++;
      if (req.url === '/ok') return res.writeHead(200).end('ok');
      if (req.url === '/redirect')
        return res
          .writeHead(302, { Location: 'http://169.254.169.254/' })
          .end();
      if (req.url === '/fail') return res.writeHead(500).end();
      // /hang: never respond
    });
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

    const probe = http.createServer();
    await new Promise<void>((r) => probe.listen(0, '127.0.0.1', r));
    closedPortUrl = `http://127.0.0.1:${(probe.address() as AddressInfo).port}/`;
    await new Promise((r) => probe.close(r));

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);
    ping = app.get(PingService);

    const user = await prisma.user.create({
      data: { email: `e2e-ping-${run}@example.com`, password: 'x' },
    });
    userId = user.id;
  });

  afterAll(async () => {
    await prisma.user.deleteMany({
      where: { email: { startsWith: `e2e-ping-${run}` } },
    });
    await app.close();
    server.closeAllConnections();
    await new Promise((r) => server.close(r));
  });

  const monitor = (url: string, extra: object = {}) =>
    prisma.monitor.create({ data: { name: 't', url, userId, ...extra } });
  const checksOf = (monitorId: string) =>
    prisma.check.findMany({ where: { monitorId } });
  const reload = (id: string) =>
    prisma.monitor.findUniqueOrThrow({ where: { id } });

  describe('outcomes (US2)', () => {
    it('records up / redirect / 5xx / timeout / refused correctly', async () => {
      const ok = await monitor(`${base}/ok`);
      const redirect = await monitor(`${base}/redirect`);
      const fail = await monitor(`${base}/fail`);
      const hang = await monitor(`${base}/hang`);
      const refused = await monitor(closedPortUrl);

      await ping.runCycle();

      const expectations: [typeof ok, string, object][] = [
        [ok, 'UP', { isUp: true, statusCode: 200, error: null }],
        [redirect, 'UP', { isUp: true, statusCode: 302, error: null }],
        [fail, 'DOWN', { isUp: false, statusCode: 500, error: null }],
        [hang, 'DOWN', { isUp: false, statusCode: null, latencyMs: null }],
        [refused, 'DOWN', { isUp: false, statusCode: null, latencyMs: null }],
      ];
      for (const [m, status, fields] of expectations) {
        const checks = await checksOf(m.id);
        expect(checks).toHaveLength(1);
        expect(checks[0]).toMatchObject(fields);
        const after = await reload(m.id);
        expect(after.status).toBe(status);
        expect(after.lastCheckedAt).not.toBeNull();
      }
      expect((await checksOf(ok.id))[0].latencyMs).toBeGreaterThanOrEqual(0);
      expect((await checksOf(hang.id))[0].error).toContain(
        'Timed out after 2000 ms',
      );
      expect((await checksOf(refused.id))[0].error).toContain('ECONNREFUSED');
    });
  });

  describe('scheduling (US1)', () => {
    it('checks only due, active monitors', async () => {
      const recent = await monitor(`${base}/ok`, {
        intervalSeconds: 300,
        lastCheckedAt: new Date(Date.now() - 10_000),
      });
      const overdue = await monitor(`${base}/ok`, {
        intervalSeconds: 300,
        lastCheckedAt: new Date(Date.now() - 301_000),
      });
      const paused = await monitor(`${base}/ok`, { isActive: false });

      await ping.runCycle();

      expect(await checksOf(recent.id)).toHaveLength(0);
      expect(await checksOf(overdue.id)).toHaveLength(1);
      expect(await checksOf(paused.id)).toHaveLength(0);
      expect((await reload(paused.id)).status).toBe('PENDING');
    });

    it('drops results for a changed URL or a deleted monitor', async () => {
      const m = await monitor(`${base}/ok`);
      const result = { isUp: true, statusCode: 200, latencyMs: 5, error: null };

      await prisma.monitor.update({
        where: { id: m.id },
        data: { url: `${base}/fail` },
      });
      await ping.recordResult(m.id, `${base}/ok`, result);
      expect(await checksOf(m.id)).toHaveLength(0);
      expect((await reload(m.id)).status).toBe('PENDING');

      await prisma.monitor.delete({ where: { id: m.id } });
      await expect(
        ping.recordResult(m.id, `${base}/fail`, result),
      ).resolves.toBeUndefined();
    });
  });

  describe('SSRF protection (US3)', () => {
    const port = () => (server.address() as AddressInfo).port;
    const blocked = { timeoutMs: 2000, allowPrivate: false };

    it.each([
      [
        'IPv4 loopback literal',
        () => `http://127.0.0.1:${port()}/ok`,
        '127.0.0.1',
      ],
      [
        'hostname resolving to loopback',
        () => `http://localhost:${port()}/ok`,
        '',
      ],
      ['IPv6 loopback literal', () => `http://[::1]:${port()}/ok`, '::1'],
      [
        'cloud metadata address',
        () => 'http://169.254.169.254/latest/meta-data',
        '169.254.169.254',
      ],
      ['IPv4-mapped IPv6', () => `http://[::ffff:127.0.0.1]:${port()}/ok`, ''],
    ])('blocks %s without connecting', async (_label, url, address) => {
      const before = hits;
      const result = await checkUrl(url(), blocked);

      expect(result).toMatchObject({
        isUp: false,
        statusCode: null,
        latencyMs: null,
      });
      expect(result.error).toMatch(/^Blocked address /);
      if (address) expect(result.error).toBe(`Blocked address ${address}`);
      expect(hits).toBe(before);
    });

    it('does not follow redirects to blocked addresses', async () => {
      // /redirect points at 169.254.169.254; with private allowed only for the
      // first hop, the result must be the 302 itself.
      const result = await checkUrl(`${base}/redirect`, {
        timeoutMs: 2000,
        allowPrivate: true,
      });
      expect(result).toMatchObject({ isUp: true, statusCode: 302 });
    });
  });
});
