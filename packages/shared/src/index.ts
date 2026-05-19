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
