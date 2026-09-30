import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type {
  AuthResponse,
  MonitorResponse,
  TelegramLinkResponse,
  TelegramStatus,
} from '@saas-pulse/shared';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { TelegramPoller } from './../src/alerts/telegram.poller';
import type { CheckResult } from './../src/ping/http-check';
import { PingService } from './../src/ping/ping.service';
import { PrismaService } from './../src/prisma/prisma.service';

interface Sent {
  chat_id: string;
  text: string;
}

const UP: CheckResult = {
  isUp: true,
  statusCode: 200,
  latencyMs: 20,
  error: null,
};
const DOWN: CheckResult = {
  isUp: false,
  statusCode: 503,
  latencyMs: 30,
  error: null,
};
const TIMEOUT: CheckResult = {
  isUp: false,
  statusCode: null,
  latencyMs: null,
  error: 'Timed out after 10000 ms',
};

/** A stand-in for api.telegram.org that records every sendMessage. */
function fakeTelegram() {
  const sent: Sent[] = [];
  let failWith: string | null = null;
  const server = http.createServer((req, res) => {
    let body = '';
    req.on('data', (c: Buffer) => (body += c.toString()));
    req.on('end', () => {
      res.setHeader('Content-Type', 'application/json');
      if (req.url?.endsWith('/getMe')) {
        return res.end(
          JSON.stringify({ ok: true, result: { username: 'test_bot' } }),
        );
      }
      if (req.url?.endsWith('/sendMessage')) {
        if (failWith) {
          return res.end(JSON.stringify({ ok: false, description: failWith }));
        }
        const { chat_id, text } = JSON.parse(body) as Sent;
        sent.push({ chat_id: String(chat_id), text });
        return res.end(JSON.stringify({ ok: true, result: {} }));
      }
      res.end(JSON.stringify({ ok: false, description: 'unknown method' }));
    });
  });
  return {
    sent,
    server,
    failNextWith: (d: string | null) => (failWith = d),
  };
}

const settle = () => new Promise((r) => setTimeout(r, 150)); // deliveries are fire-and-forget

async function bootApp(env: Record<string, string | undefined>) {
  const saved = { ...process.env };
  Object.assign(process.env, env);
  for (const [k, v] of Object.entries(env))
    if (v === undefined) delete process.env[k];
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();
  const app = moduleRef.createNestApplication<INestApplication<App>>();
  await app.init();
  process.env = saved;
  return app;
}

describe('Telegram alerts (e2e)', () => {
  const tg = fakeTelegram();
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let ping: PingService;
  let poller: TelegramPoller;
  const run = Date.now();
  let tokenA: string;
  let tokenB: string;

  const http_ = () => request(app.getHttpServer());
  const as = (t: string) => ({ Authorization: `Bearer ${t}` });

  const register = async (label: string) => {
    const res = await http_()
      .post('/auth/register')
      .send({
        email: `e2e-alerts-${run}-${label}@example.com`,
        password: 's3cret-pass',
      })
      .expect(201);
    return (res.body as AuthResponse).accessToken;
  };

  const connect = async (token: string, chatId: number) => {
    const link = await http_()
      .post('/alerts/telegram/link')
      .set(as(token))
      .expect(201);
    const code = new URL(
      (link.body as TelegramLinkResponse).url,
    ).searchParams.get('start');
    await poller.handleUpdate({
      update_id: 1,
      message: { text: `/start ${code}`, chat: { id: chatId } },
    });
  };

  const monitor = async (token: string, url = 'https://example.com') =>
    (
      await http_()
        .post('/monitors')
        .set(as(token))
        .send({ name: 'Shop', url })
        .expect(201)
    ).body as MonitorResponse;

  const feed = async (m: MonitorResponse, ...results: CheckResult[]) => {
    for (const r of results) {
      await ping.recordResult(m.id, m.url, r);
      await new Promise((resolve) => setTimeout(resolve, 5)); // distinct checkedAt
    }
    await settle();
  };

  const messagesTo = (chat: number) =>
    tg.sent.filter((s) => s.chat_id === String(chat));

  beforeAll(async () => {
    await new Promise<void>((r) => tg.server.listen(0, '127.0.0.1', r));
    const port = (tg.server.address() as AddressInfo).port;
    app = await bootApp({
      TELEGRAM_BOT_TOKEN: 'test-token',
      TELEGRAM_API_URL: `http://127.0.0.1:${port}`,
    });
    prisma = app.get(PrismaService);
    ping = app.get(PingService);
    poller = app.get(TelegramPoller);
    tokenA = await register('a');
    tokenB = await register('b');
  });

  afterAll(async () => {
    await prisma.user.deleteMany({
      where: { email: { startsWith: `e2e-alerts-${run}` } },
    });
    await app.close();
    tg.server.closeAllConnections();
    await new Promise((r) => tg.server.close(r));
  });

  describe('connecting (US1)', () => {
    it('links a chat with a one-time code', async () => {
      let status = (
        await http_().get('/alerts/telegram').set(as(tokenA)).expect(200)
      ).body as TelegramStatus;
      expect(status).toEqual({
        available: true,
        connected: false,
        enabled: false,
        connectedAt: null,
      });

      const link = (
        await http_().post('/alerts/telegram/link').set(as(tokenA)).expect(201)
      ).body as TelegramLinkResponse;
      expect(link.url).toMatch(
        /^https:\/\/t\.me\/test_bot\?start=[A-Za-z0-9_-]{24}$/,
      );
      const code = new URL(link.url).searchParams.get('start');

      await poller.handleUpdate({
        update_id: 1,
        message: { text: `/start ${code}`, chat: { id: 1001 } },
      });
      expect(messagesTo(1001).at(-1)?.text).toContain(
        'Connected to SaaS Pulse',
      );

      status = (await http_().get('/alerts/telegram').set(as(tokenA)))
        .body as TelegramStatus;
      expect(status).toMatchObject({
        available: true,
        connected: true,
        enabled: true,
      });
      expect(status.connectedAt).not.toBeNull();

      // Single use.
      await poller.handleUpdate({
        update_id: 2,
        message: { text: `/start ${code}`, chat: { id: 1002 } },
      });
      expect(messagesTo(1002).at(-1)?.text).toContain('expired');
    });

    it('explains how to connect when messaged without a code', async () => {
      await poller.handleUpdate({
        update_id: 3,
        message: { text: 'hello', chat: { id: 1003 } },
      });
      await poller.handleUpdate({
        update_id: 4,
        message: { text: '/start', chat: { id: 1003 } },
      });
      expect(messagesTo(1003).map((m) => m.text)).toEqual([
        expect.stringContaining('Settings → Connect Telegram'),
        expect.stringContaining('Settings → Connect Telegram'),
      ]);
    });
  });

  describe('incident alerts (US2)', () => {
    const CHAT = 2001;
    let token: string;

    beforeAll(async () => {
      token = await register('incident');
      await connect(token, CHAT);
      tg.sent.length = 0;
    });

    it('ignores a single-check blip', async () => {
      const m = await monitor(token);
      await feed(m, UP, DOWN, UP);
      expect(messagesTo(CHAT)).toHaveLength(0);
    });

    it('alerts once when down (after 2 failures) and once on recovery', async () => {
      const m = await monitor(token);
      await feed(m, UP, TIMEOUT, DOWN);
      expect(messagesTo(CHAT)).toHaveLength(1);
      expect(messagesTo(CHAT)[0].text).toMatch(
        /^🔴 DOWN: Shop\nhttps:\/\/example\.com\nReason: HTTP 503\nFailing since .+ UTC$/,
      );

      await feed(m, DOWN, TIMEOUT);
      expect(messagesTo(CHAT)).toHaveLength(1); // no repeats while still down

      await feed(m, UP);
      expect(messagesTo(CHAT)).toHaveLength(2);
      expect(messagesTo(CHAT)[1].text).toMatch(
        /^🟢 RECOVERED: Shop\nhttps:\/\/example\.com\nDown for \d+s$/,
      );

      await feed(m, UP);
      expect(messagesTo(CHAT)).toHaveLength(2);
    });

    it('alerts for a brand-new monitor that never came up, with the error text', async () => {
      tg.sent.length = 0;
      const m = await monitor(token);
      await feed(m, TIMEOUT, TIMEOUT);
      expect(messagesTo(CHAT)).toHaveLength(1);
      expect(messagesTo(CHAT)[0].text).toContain(
        'Reason: Timed out after 10000 ms',
      );
    });

    it('clears the incident silently when the URL changes', async () => {
      tg.sent.length = 0;
      const m = await monitor(token);
      await feed(m, DOWN, DOWN);
      expect(messagesTo(CHAT)).toHaveLength(1);

      const moved = (
        await http_()
          .patch(`/monitors/${m.id}`)
          .set(as(token))
          .send({ url: 'https://example.org' })
          .expect(200)
      ).body as MonitorResponse;
      await feed(moved, UP);
      expect(messagesTo(CHAT)).toHaveLength(1); // no "recovered" for the old address
    });

    it('sends nothing when alerts are off, but still tracks the incident', async () => {
      tg.sent.length = 0;
      await http_()
        .patch('/alerts/telegram')
        .set(as(token))
        .send({ enabled: false })
        .expect(200);
      const m = await monitor(token);
      await feed(m, DOWN, DOWN);
      expect(messagesTo(CHAT)).toHaveLength(0);
      expect(
        (await prisma.monitor.findUniqueOrThrow({ where: { id: m.id } }))
          .alertDownSince,
      ).not.toBeNull();
      await http_()
        .patch('/alerts/telegram')
        .set(as(token))
        .send({ enabled: true })
        .expect(200);
    });

    it("never sends one user's alerts to another user's chat", async () => {
      tg.sent.length = 0;
      const other = await register('noalerts'); // no channel
      const m = await monitor(other);
      await feed(m, DOWN, DOWN, UP);
      expect(tg.sent).toHaveLength(0);
    });
  });

  describe('controls (US3)', () => {
    const CHAT = 3001;
    let token: string;

    beforeAll(async () => {
      token = await register('controls');
      await connect(token, CHAT);
      tg.sent.length = 0;
    });

    afterEach(() => tg.failNextWith(null));

    it('sends a test message, and reports Telegram errors', async () => {
      await http_().post('/alerts/telegram/test').set(as(token)).expect(204);
      expect(messagesTo(CHAT).at(-1)?.text).toContain('Test alert');

      tg.failNextWith('Forbidden: bot was blocked by the user');
      const res = await http_()
        .post('/alerts/telegram/test')
        .set(as(token))
        .expect(502);
      expect(res.body).toMatchObject({
        message: 'Forbidden: bot was blocked by the user',
      });
    });

    it('validates the toggle body', () =>
      http_()
        .patch('/alerts/telegram')
        .set(as(token))
        .send({ enabled: 'yes' })
        .expect(400));

    it('disconnects', async () => {
      await http_().delete('/alerts/telegram').set(as(token)).expect(204);
      const status = (await http_().get('/alerts/telegram').set(as(token)))
        .body as TelegramStatus;
      expect(status.connected).toBe(false);
      await http_().delete('/alerts/telegram').set(as(token)).expect(404);
      await http_().post('/alerts/telegram/test').set(as(token)).expect(404);
      await http_()
        .patch('/alerts/telegram')
        .set(as(token))
        .send({ enabled: true })
        .expect(404);
    });

    it("can't read or change another user's channel", async () => {
      // A is connected (from US1); B's calls only ever see B.
      const b = (await http_().get('/alerts/telegram').set(as(tokenB)))
        .body as TelegramStatus;
      expect(b.connected).toBe(false);
      await http_().delete('/alerts/telegram').set(as(tokenB)).expect(404);
      const a = (await http_().get('/alerts/telegram').set(as(tokenA)))
        .body as TelegramStatus;
      expect(a.connected).toBe(true);
    });
  });

  describe('resilience (SC-004) and unconfigured servers (FR-011)', () => {
    it('keeps recording checks quickly when Telegram is unreachable', async () => {
      const probe = http.createServer();
      await new Promise<void>((r) => probe.listen(0, '127.0.0.1', r));
      const closed = (probe.address() as AddressInfo).port;
      await new Promise((r) => probe.close(r));

      const offline = await bootApp({
        TELEGRAM_BOT_TOKEN: 'test-token',
        TELEGRAM_API_URL: `http://127.0.0.1:${closed}`,
      });
      try {
        const token = await register('offline');
        // Channel row directly: linking needs getMe, which is unreachable here.
        const userId = (
          await prisma.user.findUniqueOrThrow({
            where: { email: `e2e-alerts-${run}-offline@example.com` },
          })
        ).id;
        await prisma.alertChannel.create({
          data: { userId, type: 'TELEGRAM', target: '4001' },
        });
        const m = await monitor(token);
        const offlinePing = offline.get(PingService);

        const start = Date.now();
        await offlinePing.recordResult(m.id, m.url, DOWN);
        await offlinePing.recordResult(m.id, m.url, DOWN);
        expect(Date.now() - start).toBeLessThan(1000);
        expect(await prisma.check.count({ where: { monitorId: m.id } })).toBe(
          2,
        );
      } finally {
        await offline.close();
      }
    });

    it('reports itself unavailable without a bot token', async () => {
      // Empty, not deleted: a deleted var falls back to a real token in apps/api/.env.
      const bare = await bootApp({ TELEGRAM_BOT_TOKEN: '' });
      try {
        const status = (
          await request(bare.getHttpServer())
            .get('/alerts/telegram')
            .set(as(tokenA))
            .expect(200)
        ).body as TelegramStatus;
        expect(status.available).toBe(false);
        await request(bare.getHttpServer())
          .post('/alerts/telegram/link')
          .set(as(tokenA))
          .expect(503);
      } finally {
        await bare.close();
      }
    });
  });
});
