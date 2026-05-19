import { Inject, Injectable } from '@nestjs/common';
import type { HealthCheckResponse, ServiceStatus } from '@saas-pulse/shared';
import Redis from 'ioredis';
import { PrismaService } from './prisma/prisma.service';
import { REDIS_CLIENT } from './redis/redis.constants';

@Injectable()
export class AppService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  getHello(): string {
    return 'SaaS Pulse API';
  }

  async getHealth(): Promise<HealthCheckResponse> {
    const database = await this.checkDatabase();
    const redis = await this.checkRedis();

    return {
      status: database === 'ok' && redis === 'ok' ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      services: { database, redis },
    };
  }

  private async checkDatabase(): Promise<ServiceStatus> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return 'ok';
    } catch {
      return 'error';
    }
  }

  private async checkRedis(): Promise<ServiceStatus> {
    try {
      const pong = await this.redis.ping();
      return pong === 'PONG' ? 'ok' : 'error';
    } catch {
      return 'error';
    }
  }
}
