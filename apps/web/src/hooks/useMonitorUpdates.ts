/**
 * useMonitorUpdates Hook
 *
 * Listens to real-time monitor updates (status and stats) via Socket.io.
 * Implements client-side deduplication via timestamp tracking.
 * Falls back to polling if Socket.io is unavailable.
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { useSocket } from './useSocket';
import type {
  MonitorStatusChangeEvent,
  MonitorStatsUpdateEvent,
} from '@saas-pulse/shared';

export interface MonitorUpdate {
  monitorId: string;
  type: 'status' | 'stats';
  data: MonitorStatusChangeEvent | MonitorStatsUpdateEvent;
}

interface PollingState {
  enabled: boolean;
  intervalId?: ReturnType<typeof setInterval>;
}

export function useMonitorUpdates(onUpdate: (update: MonitorUpdate) => void) {
  const socket = useSocket();
  const lastSeenTimestampRef = useRef<Record<string, number>>({});
  const [pollingActive, setPollingActive] = useState(false);
  const pollingRef = useRef<PollingState>({ enabled: false });

  const enablePolling = useCallback(() => {
    if (pollingRef.current.enabled) return;

    console.debug('[useMonitorUpdates] Enabling polling (Socket.io unavailable)');
    setPollingActive(true);
    pollingRef.current.enabled = true;

    // Polling is handled externally via MonitorsPage.tsx existing fetch logic
    // This callback just marks that polling is active
  }, []);

  const disablePolling = useCallback(() => {
    if (!pollingRef.current.enabled) return;

    console.debug('[useMonitorUpdates] Disabling polling (Socket.io connected)');
    setPollingActive(false);
    pollingRef.current.enabled = false;

    if (pollingRef.current.intervalId) {
      clearInterval(pollingRef.current.intervalId);
      pollingRef.current.intervalId = undefined;
    }
  }, []);

  const handleStatusChange = useCallback(
    (event: MonitorStatusChangeEvent) => {
      const lastSeen = lastSeenTimestampRef.current[event.monitorId] ?? 0;

      // Idempotency: only process if newer than last seen
      if (event.timestamp <= lastSeen) {
        console.debug(
          '[useMonitorUpdates] Ignoring duplicate status event for monitor',
          event.monitorId,
        );
        return;
      }

      lastSeenTimestampRef.current[event.monitorId] = event.timestamp;

      console.debug(
        '[useMonitorUpdates] Status update:',
        event.monitorId,
        '→',
        event.status,
      );

      onUpdate({
        monitorId: event.monitorId,
        type: 'status',
        data: event,
      });
    },
    [onUpdate],
  );

  const handleStatsUpdate = useCallback(
    (event: MonitorStatsUpdateEvent) => {
      const lastSeen = lastSeenTimestampRef.current[event.monitorId] ?? 0;

      // Idempotency: only process if newer than last seen
      if (event.timestamp <= lastSeen) {
        console.debug(
          '[useMonitorUpdates] Ignoring duplicate stats event for monitor',
          event.monitorId,
        );
        return;
      }

      lastSeenTimestampRef.current[event.monitorId] = event.timestamp;

      console.debug(
        '[useMonitorUpdates] Stats update:',
        event.monitorId,
        `uptime=${event.uptime24h}%`,
      );

      onUpdate({
        monitorId: event.monitorId,
        type: 'stats',
        data: event,
      });
    },
    [onUpdate],
  );

  useEffect(() => {
    if (!socket) {
      enablePolling();
      return;
    }

    // Listen to socket events
    (socket as any).on('monitor:status-change', handleStatusChange);
    (socket as any).on('monitor:stats-update', handleStatsUpdate);

    // Handle connection state
    const handleConnect = () => {
      console.debug('[useMonitorUpdates] Socket connected');
      disablePolling();
    };

    const handleDisconnect = (reason: string) => {
      console.debug('[useMonitorUpdates] Socket disconnected:', reason);
      enablePolling();
    };

    const handleReconnect = () => {
      console.debug('[useMonitorUpdates] Socket reconnected - syncing full state');
      // Full state sync is handled by MonitorsPage.tsx via fetchMonitors()
      // This is just to log the reconnection event
    };

    (socket as any).on('connect', handleConnect);
    (socket as any).on('disconnect', handleDisconnect);
    (socket as any).on('reconnect', handleReconnect);

    // Cleanup listeners
    return () => {
      (socket as any).off('monitor:status-change', handleStatusChange);
      (socket as any).off('monitor:stats-update', handleStatsUpdate);
      (socket as any).off('connect', handleConnect);
      (socket as any).off('disconnect', handleDisconnect);
      (socket as any).off('reconnect', handleReconnect);
    };
  }, [socket, handleStatusChange, handleStatsUpdate, enablePolling, disablePolling]);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollingRef.current.intervalId) {
        clearInterval(pollingRef.current.intervalId);
      }
    };
  }, []);

  return {
    pollingActive,
    lastSeenTimestamp: lastSeenTimestampRef.current,
  };
}
