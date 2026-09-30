/**
 * Socket.io Service
 *
 * Emits real-time events to connected clients scoped by user.
 *
 * @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
 * are disabled due to NestJS WebSocketGateway decorator limitations.
 */
/* eslint-disable @typescript-eslint/no-unsafe-call,
@typescript-eslint/no-unsafe-member-access */

import { Injectable } from '@nestjs/common';
import { Server } from 'socket.io';
import { WebSocketServer } from '@nestjs/websockets';
import type {
  MonitorStatusChangeEvent,
  MonitorStatsUpdateEvent,
} from '@saas-pulse/shared';

@Injectable()
export class SocketService {
  @WebSocketServer() server: Server;

  /**
   * Emit monitor status change event to user's room
   */
  emitStatusChange(
    userId: string,
    monitorId: string,
    status: 'UP' | 'DOWN' | 'PENDING',
  ): void {
    if (!this.server) return;

    const event: MonitorStatusChangeEvent = {
      monitorId,
      status,
      timestamp: Date.now(),
    };

    const roomName = `user:${userId}`;
    this.server.to(roomName).emit('monitor:status-change', event);
    console.debug(`[Socket.io] Status change emitted to ${roomName}:`, event);
  }

  /**
   * Emit monitor stats update event to user's room
   */
  emitStatUpdate(
    userId: string,
    monitorId: string,
    uptime24h: number,
    latency24hAvg: number,
    latency24hMin: number,
    latency24hMax: number,
  ): void {
    if (!this.server) return;

    const event: MonitorStatsUpdateEvent = {
      monitorId,
      uptime24h,
      latency24hAvg,
      latency24hMin,
      latency24hMax,
      timestamp: Date.now(),
    };

    const roomName = `user:${userId}`;
    this.server.to(roomName).emit('monitor:stats-update', event);
    console.debug(`[Socket.io] Stats update emitted to ${roomName}:`, event);
  }
}
