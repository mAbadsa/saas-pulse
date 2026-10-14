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

export function useMonitorUpdates(onUpdate: (update: MonitorUpdate) => void) {
  const socket = useSocket();
  const lastSeenTimestampRef = useRef<Record<string, number>>({});
  const [pollingActive, setPollingActive] = useState(false);
  const pollingRef = useRef(false);

  // Polling itself lives in MonitorsPage.tsx; this only tracks whether it's needed
  const enablePolling = useCallback(() => {
    if (pollingRef.current) return;

    console.debug('[useMonitorUpdates] Enabling polling (Socket.io unavailable)');
    setPollingActive(true);
    pollingRef.current = true;
  }, []);

  const disablePolling = useCallback(() => {
    if (!pollingRef.current) return;

    console.debug('[useMonitorUpdates] Disabling polling (Socket.io connected)');
    setPollingActive(false);
    pollingRef.current = false;
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
    socket.on('monitor:status-change', handleStatusChange);
    socket.on('monitor:stats-update', handleStatsUpdate);

    // Handle connection state
    const handleConnect = () => {
      console.debug('[useMonitorUpdates] Socket connected');
      disablePolling();
    };

    const handleDisconnect = (reason: string) => {
      console.debug('[useMonitorUpdates] Socket disconnected:', reason);
      enablePolling();
    };

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);

    // Cleanup listeners
    return () => {
      socket.off('monitor:status-change', handleStatusChange);
      socket.off('monitor:stats-update', handleStatsUpdate);
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
    };
  }, [socket, handleStatusChange, handleStatsUpdate, enablePolling, disablePolling]);

  return {
    pollingActive,
    // return the ref object instead of reading .current during render
    lastSeenTimestamp: lastSeenTimestampRef,
  };
}
