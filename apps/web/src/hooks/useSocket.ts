/**
 * useSocket Hook
 *
 * Manages Socket.io connection lifecycle:
 * - Connects when component mounts
 * - Disconnects on unmount
 * - Pauses on tab hide, resumes on tab show
 * - Handles reconnection on network loss
 */

import { useEffect, useCallback, useSyncExternalStore } from 'react';
import { useAuth } from '../auth/auth-context';
import { loadSession } from '../lib/session';
import {
  initializeSocket,
  disconnectSocket,
  getSocket,
  subscribeSocket,
} from '../lib/socket-client';

export function useSocket() {
  const { user } = useAuth();
  const socket = useSyncExternalStore(subscribeSocket, getSocket);

  const handleVisibilityChange = useCallback(() => {
    const current = getSocket();
    if (!current) return;

    if (document.hidden) {
      console.debug('[useSocket] Tab hidden - disconnecting');
      current.disconnect();
    } else {
      console.debug('[useSocket] Tab visible - reconnecting');
      current.connect();
    }
  }, []);

  useEffect(() => {
    // Only initialize if user is authenticated
    if (!user) {
      disconnectSocket();
      return;
    }

    // Get token from session storage
    const session = loadSession();
    if (!session?.accessToken) {
      disconnectSocket();
      return;
    }

    // Initialize socket connection
    initializeSocket(session.accessToken);

    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Cleanup on unmount
    return () => {
      document.removeEventListener(
        'visibilitychange',
        handleVisibilityChange,
      );
      disconnectSocket();
    };
  }, [user, handleVisibilityChange]);

  return socket;
}

/**
 * Hook to check if Socket.io is connected
 */
export function useSocketConnected(): boolean {
  const socket = useSocket();
  // This is a simple check; for reactive updates, useMonitorUpdates is better
  return socket?.connected ?? false;
}
