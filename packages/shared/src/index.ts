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
