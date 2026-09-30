/**
 * Socket.io Gateway
 *
 * Handles WebSocket connections, authentication, and room management
 * for real-time dashboard updates.
 *
 * @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access,
 * @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-assignment
 * are disabled due to NestJS WebSocketGateway decorator limitations.
 */
/* eslint-disable @typescript-eslint/no-unsafe-call,
@typescript-eslint/no-unsafe-member-access,
@typescript-eslint/no-unsafe-argument,
@typescript-eslint/no-unsafe-assignment */

import {
  WebSocketGateway,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Inject, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Socket } from 'socket.io';
import { REDIS_CLIENT } from '../redis/redis.constants';
import type { Redis } from 'ioredis';

@WebSocketGateway({
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
    methods: ['GET', 'POST'],
    credentials: true,
  },
})
@Injectable()
export class SocketGateway implements OnGatewayConnection, OnGatewayDisconnect {
  constructor(
    private jwtService: JwtService,
    @Inject(REDIS_CLIENT) private redis: Redis,
  ) {}

  async handleConnection(client: Socket) {
    try {
      // Extract and validate JWT token from handshake
      const token = client.handshake.auth.token;
      if (!token) {
        client.disconnect();
        return;
      }

      // Remove "Bearer " prefix if present
      const cleanToken = token.startsWith('Bearer ') ? token.slice(7) : token;

      // Verify token and extract user ID
      const payload = await this.jwtService.verifyAsync(cleanToken);
      const userId = payload.sub;

      if (!userId) {
        client.disconnect();
        return;
      }

      // Join user-scoped room for event broadcasting
      const roomName = `user:${userId}`;
      client.join(roomName);

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
        '[Socket.io] Connection failed:',
        error instanceof Error ? error.message : 'Unknown error',
      );
      client.disconnect();
    }
  }

  async handleDisconnect(client: Socket) {
    // Clean up Redis entry
    await this.redis.del(`socket:connection:${client.id}`);
    console.debug(`[Socket.io] Client disconnected: ${client.id}`);
  }
}
