import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Patch,
  Post,
} from '@nestjs/common';
import type { UserProfile } from '@saas-pulse/shared';
import { CurrentUser } from '../auth/auth.decorators';
import { UpdateTelegramDto } from './alerts.dto';
import { AlertsService } from './alerts.service';

@Controller('alerts/telegram')
export class AlertsController {
  constructor(private readonly alerts: AlertsService) {}

  @Get()
  status(@CurrentUser() user: UserProfile) {
    return this.alerts.status(user.id);
  }

  @Post('link')
  link(@CurrentUser() user: UserProfile) {
    return this.alerts.createLink(user.id);
  }

  @Patch()
  update(@CurrentUser() user: UserProfile, @Body() dto: UpdateTelegramDto) {
    return this.alerts.setEnabled(user.id, dto.enabled);
  }

  @Delete()
  @HttpCode(204)
  disconnect(@CurrentUser() user: UserProfile) {
    return this.alerts.disconnect(user.id);
  }

  @Post('test')
  @HttpCode(204)
  test(@CurrentUser() user: UserProfile) {
    return this.alerts.sendTest(user.id);
  }
}
