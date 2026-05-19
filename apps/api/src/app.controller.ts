import { Controller, Get } from '@nestjs/common';
import type { HealthCheckResponse } from '@saas-pulse/shared';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('health')
  getHealth(): Promise<HealthCheckResponse> {
    return this.appService.getHealth();
  }
}
