import { Module } from '@nestjs/common';
import { AlertsController } from './alerts.controller';
import { AlertsService } from './alerts.service';
import { TelegramClient } from './telegram.client';
import { TelegramPoller } from './telegram.poller';
import { SlackDeliveryService } from './slack-delivery.service';
import { DiscordDeliveryService } from './discord-delivery.service';
import { EmailDeliveryService } from './email-delivery.service';

@Module({
  controllers: [AlertsController],
  providers: [
    AlertsService,
    TelegramClient,
    TelegramPoller,
    SlackDeliveryService,
    DiscordDeliveryService,
    EmailDeliveryService,
  ],
  exports: [AlertsService, TelegramPoller],
})
export class AlertsModule {}
