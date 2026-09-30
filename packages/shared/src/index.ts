export type ServiceStatus = 'ok' | 'error';

export interface HealthCheckResponse {
  status: 'ok' | 'degraded';
  timestamp: string;
  services: {
    database: ServiceStatus;
    redis: ServiceStatus;
  };
}

export interface ApiErrorResponse {
  statusCode: number;
  message: string;
  error?: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  name?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface UserProfile {
  id: string;
  email: string;
  name: string | null;
}

export interface AuthResponse {
  accessToken: string;
  user: UserProfile;
}

export type MonitorStatus = 'PENDING' | 'UP' | 'DOWN';

export interface MonitorResponse {
  id: string;
  name: string;
  url: string;
  intervalSeconds: number;
  isActive: boolean;
  status: MonitorStatus;
  lastCheckedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateMonitorRequest {
  name: string;
  url: string;
  intervalSeconds?: number;
}

export interface UpdateMonitorRequest {
  name?: string;
  url?: string;
  intervalSeconds?: number;
  isActive?: boolean;
}

export type StatsRange = '24h' | '7d';

export interface MonitorStatsSummary {
  monitorId: string;
  checks: number;
  uptimePercent: number | null;
  avgLatencyMs: number | null;
}

export interface StatsPoint {
  t: string;
  checks: number;
  uptimePercent: number | null;
  avgLatencyMs: number | null;
}

export interface CheckResponse {
  id: string;
  checkedAt: string;
  isUp: boolean;
  statusCode: number | null;
  latencyMs: number | null;
  error: string | null;
}

export interface MonitorStatsDetail {
  monitorId: string;
  range: StatsRange;
  bucketSeconds: number;
  checks: number;
  uptimePercent: number | null;
  avgLatencyMs: number | null;
  series: StatsPoint[];
  recent: CheckResponse[];
}

export interface TelegramStatus {
  available: boolean;
  connected: boolean;
  enabled: boolean;
  connectedAt: string | null;
}

export interface TelegramLinkResponse {
  url: string;
  expiresAt: string;
}

export interface UpdateTelegramRequest {
  enabled: boolean;
}

// Socket.io Real-Time Events
export type {
  MonitorStatusChangeEvent,
  MonitorStatsUpdateEvent,
  SocketEventsMap,
} from './socket-events';
