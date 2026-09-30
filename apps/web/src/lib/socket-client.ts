/**
 * Socket.io Client Initialization & Management
 *
 * Handles real-time connection to API server, authentication,
 * and graceful fallback to polling on connection loss.
 */

import { io, Socket } from 'socket.io-client';
import type { SocketEventsMap } from '@saas-pulse/shared';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

let socketInstance: Socket<SocketEventsMap> | null = null;

export function initializeSocket(token: string): Socket<SocketEventsMap> {
  if (socketInstance?.connected) {
    return socketInstance;
  }

  socketInstance = io(API_URL, {
    auth: {
      token: `Bearer ${token}`,
    },
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    reconnectionAttempts: 10,
  });

  socketInstance.on('connect_error', (error) => {
    console.debug('[Socket.io] Connection error:', error.message);
  });

  socketInstance.on('disconnect', (reason) => {
    console.debug('[Socket.io] Disconnected:', reason);
  });

  return socketInstance;
}

export function getSocket(): Socket<SocketEventsMap> | null {
  return socketInstance;
}

export function disconnectSocket(): void {
  if (socketInstance) {
    socketInstance.disconnect();
    socketInstance = null;
  }
}

export function isConnected(): boolean {
  return socketInstance?.connected ?? false;
}
