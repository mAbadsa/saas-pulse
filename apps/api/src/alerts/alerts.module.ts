import { Module } from '@nestjs/common';
import { AlertsController } from './alerts.controller';
import { AlertsService } from './alerts.service';
import { TelegramClient } from './telegram.client';
import { TelegramPoller } from './telegram.poller';

@Module({
  controllers: [AlertsController],
  providers: [AlertsService, TelegramClient, TelegramPoller],
  exports: [AlertsService, TelegramPoller],
})
export class AlertsModule {}
