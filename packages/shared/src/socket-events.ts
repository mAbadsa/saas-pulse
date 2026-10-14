/**
 * Socket.io Event Types
 *
 * Real-time event schemas for live dashboard updates.
 * Shared between API and web app for type safety.
 */

export interface MonitorStatusChangeEvent {
  /** Monitor UUID */
  monitorId: string;

  /** New status */
  status: 'UP' | 'DOWN' | 'PENDING';

  /** Server timestamp (ms since epoch); used for client-side deduplication */
  timestamp: number;
}

export interface MonitorStatsUpdateEvent {
  /** Monitor UUID */
  monitorId: string;

  /** 24-hour uptime percentage (0-100) */
  uptime24h: number;

  /** 24-hour average latency in milliseconds */
  latency24hAvg: number;

  /** 24-hour minimum latency in milliseconds */
  latency24hMin: number;

  /** 24-hour maximum latency in milliseconds */
  latency24hMax: number;

  /** Server timestamp (ms since epoch); used for client-side deduplication */
  timestamp: number;
}

/** Server-to-client events as listener signatures, the shape socket.io-client expects */
export interface SocketEventsMap {
  'monitor:status-change': (event: MonitorStatusChangeEvent) => void;
  'monitor:stats-update': (event: MonitorStatsUpdateEvent) => void;
}
