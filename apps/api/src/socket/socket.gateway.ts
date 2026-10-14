/**
 * Socket.io Gateway
 *
 * Handles WebSocket connections, authentication, and room management
 * for real-time dashboard updates.
 */

import {
  WebSocketGateway,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
} from '@nestjs/websockets';
import { Inject, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Server, Socket } from 'socket.io';
import { REDIS_CLIENT } from '../redis/redis.constants';
import type { Redis } from 'ioredis';

/** Set by the auth middleware in afterInit, read by handleConnection. */
interface SocketData {
  userId: string;
}

@WebSocketGateway({
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
    methods: ['GET', 'POST'],
    credentials: true,
  },
})
@Injectable()
export class SocketGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  constructor(
    private jwtService: JwtService,
    @Inject(REDIS_CLIENT) private redis: Redis,
  ) {}

  /** Reject unauthenticated handshakes before they connect, not after. */
  afterInit(server: Server) {
    server.use((client, next) => {
      this.authenticate(client).then(
        () => next(),
        () => next(new Error('unauthorized')),
      );
    });
  }

  private async authenticate(client: Socket): Promise<void> {
    const token = client.handshake.auth.token as string | undefined;
    if (!token) throw new Error('missing token');

    // Remove "Bearer " prefix if present
    const cleanToken = token.startsWith('Bearer ') ? token.slice(7) : token;
    const payload = await this.jwtService.verifyAsync<{ sub?: string }>(
      cleanToken,
    );
    if (!payload.sub) throw new Error('no subject');

    (client.data as SocketData).userId = payload.sub;
  }

  async handleConnection(client: Socket) {
    const { userId } = client.data as SocketData;
    try {
      // Join user-scoped room for event broadcasting
      await client.join(`user:${userId}`);

      // Store connection in Redis for debugging/stats (optional)
      await this.redis.setex(
        `socket:connection:${client.id}`,
        3600, // 1 hour TTL
        JSON.stringify({ userId, connectedAt: new Date().toISOString() }),
      );

      console.debug(
        `[Socket.io] Client connected: ${client.id} (user: ${userId})`,
      );
    } catch (error) {
      console.debug(
        '[Socket.io] Connection setup failed:',
        error instanceof Error ? error.message : 'Unknown error',
      );
      client.disconnect();
    }
  }

  async handleDisconnect(client: Socket) {
    // Clean up Redis entry; a failed cleanup must not surface as an unhandled rejection
    try {
      await this.redis.del(`socket:connection:${client.id}`);
    } catch (error) {
      console.debug(
        '[Socket.io] Cleanup failed:',
        error instanceof Error ? error.message : 'Unknown error',
      );
    }
    console.debug(`[Socket.io] Client disconnected: ${client.id}`);
  }
}
