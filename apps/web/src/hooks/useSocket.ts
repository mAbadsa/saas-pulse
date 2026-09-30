/**
 * useSocket Hook
 *
 * Manages Socket.io connection lifecycle:
 * - Connects when component mounts
 * - Disconnects on unmount
 * - Pauses on tab hide, resumes on tab show
 * - Handles reconnection on network loss
 */

import { useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../auth/auth-context';
import { loadSession } from '../lib/session';
import {
  initializeSocket,
  disconnectSocket,
} from '../lib/socket-client';
import type { Socket } from 'socket.io-client';
import type { SocketEventsMap } from '@saas-pulse/shared';

export function useSocket() {
  const { user } = useAuth();
  const socketRef = useRef<Socket<SocketEventsMap> | null>(null);
  const visibilityListenerRef = useRef<(() => void) | null>(null);

  const handleVisibilityChange = useCallback(() => {
    if (!socketRef.current) return;

    if (document.hidden) {
      console.debug('[useSocket] Tab hidden - disconnecting');
      socketRef.current.disconnect();
    } else {
      console.debug('[useSocket] Tab visible - reconnecting');
      socketRef.current.connect();
    }
  }, []);

  useEffect(() => {
    // Only initialize if user is authenticated
    if (!user) {
      disconnectSocket();
      socketRef.current = null;
      return;
    }

    // Get token from session storage
    const session = loadSession();
    if (!session?.accessToken) {
      disconnectSocket();
      socketRef.current = null;
      return;
    }

    // Initialize socket connection
    socketRef.current = initializeSocket(session.accessToken);

    // Add visibility listener
    visibilityListenerRef.current = handleVisibilityChange;
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Cleanup on unmount
    return () => {
      document.removeEventListener(
        'visibilitychange',
        handleVisibilityChange,
      );
      disconnectSocket();
      socketRef.current = null;
    };
  }, [user, handleVisibilityChange]);

  return socketRef.current;
}

/**
 * Hook to check if Socket.io is connected
 */
export function useSocketConnected(): boolean {
  const socket = useSocket();
  // This is a simple check; for reactive updates, useMonitorUpdates is better
  return socket?.connected ?? false;
}
