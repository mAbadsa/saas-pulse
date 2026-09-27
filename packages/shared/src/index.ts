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
