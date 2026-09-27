import { INestApplication, RequestMethod } from '@nestjs/common';
import { DiscoveryService, MetadataScanner, Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import type { ApiErrorResponse, AuthResponse } from '@saas-pulse/shared';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/prisma/prisma.service';

describe('Auth (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const run = Date.now();
  const email = `e2e-${run}@example.com`;
  const password = 's3cret-pass';

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
      providers: [DiscoveryService, MetadataScanner],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await prisma.user.deleteMany({
      where: { email: { startsWith: `e2e-${run}` } },
    });
    await app.close();
  });

  const http = () => request(app.getHttpServer());

  describe('POST /auth/register', () => {
    it('creates an account with a normalized email and no password in the response', async () => {
      const res = await http()
        .post('/auth/register')
        .send({ email: `  E2E-${run}@Example.com `, password, name: 'Ana' })
        .expect(201);

      const body = res.body as AuthResponse;
      expect(body.accessToken).toEqual(expect.any(String));
      expect(body.user).toEqual({
        id: expect.any(String) as string,
        email,
        name: 'Ana',
      });
      expect(JSON.stringify(body)).not.toContain('password');
    });

    it('rejects the same email in a different case with 409', () =>
      http()
        .post('/auth/register')
        .send({ email: email.toUpperCase(), password })
        .expect(409));

    it.each([
      ['invalid email', { email: 'not-an-email', password }],
      [
        '7-char password',
        { email: `e2e-${run}-a@example.com`, password: '1234567' },
      ],
      [
        'password over 72 bytes',
        { email: `e2e-${run}-b@example.com`, password: 'é'.repeat(37) },
      ],
      [
        'unknown field',
        { email: `e2e-${run}-c@example.com`, password, id: 'mine' },
      ],
    ])('rejects %s with 400', (_label, body) =>
      http().post('/auth/register').send(body).expect(400),
    );
  });

  describe('POST /auth/login', () => {
    it('signs in with any email casing', async () => {
      const res = await http()
        .post('/auth/login')
        .send({ email: email.toUpperCase(), password })
        .expect(200);
      expect((res.body as AuthResponse).user.email).toBe(email);
    });

    it('gives identical 401s for a wrong password and an unknown email', async () => {
      const wrong = await http()
        .post('/auth/login')
        .send({ email, password: 'wrong-pass' })
        .expect(401);
      const unknown = await http()
        .post('/auth/login')
        .send({ email: `nobody-${run}@example.com`, password: 'wrong-pass' })
        .expect(401);
      expect(wrong.body).toEqual(unknown.body);
      expect((wrong.body as ApiErrorResponse).message).toBe(
        'Invalid email or password',
      );
    });
  });

  describe('GET /auth/me and the guard', () => {
    let token: string;

    beforeAll(async () => {
      const res = await http().post('/auth/login').send({ email, password });
      token = (res.body as AuthResponse).accessToken;
    });

    it('returns the caller profile', async () => {
      const res = await http()
        .get('/auth/me')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(res.body).toEqual({
        id: expect.any(String) as string,
        email,
        name: 'Ana',
      });
    });

    it('rejects missing, malformed, tampered and expired tokens', async () => {
      const jwt = app.get(JwtService);
      const { sub } = jwt.decode<{ sub: string }>(token);
      const expired = await jwt.signAsync({ sub }, { expiresIn: '-1s' });

      for (const auth of [
        undefined,
        `Token ${token}`,
        `Bearer ${token}x`,
        `Bearer ${expired}`,
      ]) {
        const req = http().get('/auth/me');
        if (auth) req.set('Authorization', auth);
        await req.expect(401);
      }
    });

    it('rejects a token whose user was deleted', async () => {
      const res = await http()
        .post('/auth/register')
        .send({ email: `e2e-${run}-gone@example.com`, password });
      const gone = res.body as AuthResponse;
      await prisma.user.delete({ where: { id: gone.user.id } });

      await http()
        .get('/auth/me')
        .set('Authorization', `Bearer ${gone.accessToken}`)
        .expect(401);
    });

    it('keeps / and /health public', async () => {
      await http().get('/').expect(200);
      await http().get('/health').expect(200);
    });
  });

  // SC-002: every route outside this allowlist must require a token, including future ones.
  it('protects every non-public route', async () => {
    const PUBLIC = [
      'GET /',
      'GET /health',
      'POST /auth/register',
      'POST /auth/login',
    ];
    const discovery = app.get(DiscoveryService);
    const scanner = app.get(MetadataScanner);
    const reflector = app.get(Reflector);

    const routes: string[] = [];
    for (const { instance, metatype } of discovery.getControllers()) {
      if (!instance || !metatype) continue;
      const base = reflector.get<string>('path', metatype) ?? '';
      const controller = instance as Record<string, () => unknown>;
      for (const name of scanner.getAllMethodNames(
        Object.getPrototypeOf(controller) as object,
      )) {
        const handler = controller[name];
        const path = reflector.get<string>('path', handler);
        const method = reflector.get<RequestMethod>('method', handler);
        if (path === undefined || method === undefined) continue;
        const full = '/' + [base, path].filter((p) => p && p !== '/').join('/');
        routes.push(`${RequestMethod[method]} ${full}`);
      }
    }

    const protectedRoutes = routes.filter((r) => !PUBLIC.includes(r));
    expect(protectedRoutes.length).toBeGreaterThan(0);
    for (const route of protectedRoutes) {
      const [method, path] = route.split(' ');
      await http()[method.toLowerCase() as 'get'](path).expect(401);
    }
  });
});
