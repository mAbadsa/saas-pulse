/**
 * Socket.io E2E Tests
 *
 * Tests Socket.io gateway authentication and connection lifecycle.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { JwtService } from '@nestjs/jwt';
import { io, Socket as ClientSocket } from 'socket.io-client';

describe('Socket.io E2E Tests', () => {
  let app: INestApplication;
  let jwtService: JwtService;

  // Test data
  let user1Token: string;
  let user2Token: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    await app.listen(3001); // Use different port for testing

    jwtService = moduleFixture.get<JwtService>(JwtService);

    user1Token = jwtService.sign({
      sub: 'test-user-1',
      email: 'user1@test.com',
    });
    user2Token = jwtService.sign({
      sub: 'test-user-2',
      email: 'user2@test.com',
    });
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Authentication', () => {
    it('should connect with valid JWT token', (done) => {
      const socket: ClientSocket = io('http://localhost:3001', {
        auth: { token: `Bearer ${user1Token}` },
      });

      socket.on('connect', () => {
        expect(socket.connected).toBe(true);
        socket.disconnect();
        done();
      });

      socket.on('connect_error', () => {
        done(new Error('Connection should succeed with valid token'));
      });
    });

    it('should disconnect with invalid token', (done) => {
      const socket: ClientSocket = io('http://localhost:3001', {
        auth: { token: 'Bearer invalid.token.here' },
      });

      socket.on('connect', () => {
        done(new Error('Should not connect with invalid token'));
      });

      socket.on('connect_error', () => {
        expect(socket.connected).toBe(false);
        socket.disconnect();
        done();
      });
    });

    it('should disconnect without token', (done) => {
      const socket: ClientSocket = io('http://localhost:3001', {
        auth: {},
      });

      socket.on('connect', () => {
        done(new Error('Should not connect without token'));
      });

      socket.on('connect_error', () => {
        expect(socket.connected).toBe(false);
        socket.disconnect();
        done();
      });
    });
  });

  describe('Connection Lifecycle', () => {
    it('should maintain separate connections for different users', (done) => {
      const socket1: ClientSocket = io('http://localhost:3001', {
        auth: { token: `Bearer ${user1Token}` },
      });

      const socket2: ClientSocket = io('http://localhost:3001', {
        auth: { token: `Bearer ${user2Token}` },
      });

      let connectCount = 0;
      const onConnected = () => {
        connectCount++;
        if (connectCount === 2) {
          expect(socket1.connected).toBe(true);
          expect(socket2.connected).toBe(true);
          socket1.disconnect();
          socket2.disconnect();
          done();
        }
      };

      socket1.on('connect', onConnected);
      socket2.on('connect', onConnected);
    });
  });
});
