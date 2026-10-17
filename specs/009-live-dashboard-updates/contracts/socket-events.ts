/**
 * Socket.io Event Contract
 *
 * These event types are emitted by the API server to connected web clients.
 * Used in packages/shared/src/socket-events.ts (implementation).
 *
 * Scope: User-scoped (each user only receives events for their own monitors)
 * Transport: WebSocket (Socket.io with HTTP long-polling fallback)
 * Persistence: Ephemeral (events not stored; fire-and-forget)
 */

/**
 * Monitor Status Changed
 *
 * Emitted when a monitor's status changes (UP -> DOWN, DOWN -> UP, etc.)
 * after a new check result is recorded.
 *
 * Event Name: 'monitor:status-change'
 */
export interface MonitorStatusChangeEvent {
  /** Monitor UUID */
  monitorId: string;

  /** New status */
  status: 'UP' | 'DOWN' | 'PENDING';

  /** Server timestamp (ms since epoch); used for client-side deduplication */
  timestamp: number;
}

/**
 * Monitor Stats Updated
 *
 * Emitted when monitor statistics are computed and updated.
 * Stats include 24-hour uptime percentage and average latency.
 * Emitted after each new check is recorded.
 *
 * Event Name: 'monitor:stats-update'
 */
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

/**
 * Server -> Client Event Map
 *
 * List of all events the server emits to clients. Used for TypeScript
 * socket client typing (e.g., `socket.on<T>(event, callback)`).
 */
export interface SocketEventsMap {
  'monitor:status-change': MonitorStatusChangeEvent;
  'monitor:stats-update': MonitorStatsUpdateEvent;
}

/**
 * Authentication
 *
 * Socket.io connections must include a valid JWT token.
 * Token is passed in the connection handshake:
 *
 * Client:
 *   const socket = io('http://localhost:3000', {
 *     auth: {
 *       token: 'Bearer eyJ...',
 *     },
 *   });
 *
 * Server:
 *   - Validates token via JwtService
 *   - Extracts user ID from token payload
 *   - Joins client to room: `user:{userId}`
 *   - Disconnects if token invalid or expired
 *
 * All events are automatically scoped to the authenticated user's room.
 */

/**
 * Deduplication & Ordering
 *
 * Clients MUST implement deduplication using the `timestamp` field:
 *
 *   const lastSeenTimestamp = useRef<Record<string, number>>({});
 *
 *   socket.on('monitor:status-change', (event) => {
 *     if (event.timestamp > (lastSeenTimestamp.current[event.monitorId] || 0)) {
 *       lastSeenTimestamp.current[event.monitorId] = event.timestamp;
 *       // Update UI
 *     }
 *   });
 *
 * This ensures:
 * - Events are processed in server order (latest state wins)
 * - Duplicate events are ignored (if connection duplicates the message)
 * - Out-of-order delivery is handled correctly
 */

/**
 * Fallback & Reconnection
 *
 * Socket.io client library automatically handles:
 * - Fallback to HTTP long-polling if WebSocket unavailable
 * - Auto-reconnect on network loss (with exponential backoff)
 * - State sync: Client MUST call GET /monitors to refresh full state on reconnect
 *
 * Web app implementation (useMonitorUpdates hook):
 *   socket.on('connect', () => {
 *     // Real-time updates resumed
 *     disablePolling();
 *   });
 *
 *   socket.on('disconnect', () => {
 *     // Fall back to polling until reconnected
 *     enablePolling();
 *   });
 *
 *   socket.on('reconnect', () => {
 *     // Full state sync after offline period
 *     fetchMonitors();
 *   });
 */
