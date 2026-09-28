import { Controller, Get } from '@nestjs/common';
import type { HealthCheckResponse } from '@saas-pulse/shared';
import { AppService } from './app.service';
import { Public } from './auth/auth.decorators';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Public()
  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Public()
  @Get('health')
  getHealth(): Promise<HealthCheckResponse> {
    return this.appService.getHealth();
  }
}
