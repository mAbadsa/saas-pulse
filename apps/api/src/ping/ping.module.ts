import { Module } from '@nestjs/common';
import { AlertsModule } from '../alerts/alerts.module';
import { CheckRetentionService } from './check-retention.service';
import { PingService } from './ping.service';

@Module({
  imports: [AlertsModule],
  providers: [PingService, CheckRetentionService],
  exports: [PingService, CheckRetentionService],
})
export class PingModule {}
