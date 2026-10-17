import { Module } from '@nestjs/common';
import { AlertsModule } from '../alerts/alerts.module';
import { SocketModule } from '../socket/socket.module';
import { CheckRetentionService } from './check-retention.service';
import { PingService } from './ping.service';

@Module({
  imports: [AlertsModule, SocketModule],
  providers: [PingService, CheckRetentionService],
  exports: [PingService, CheckRetentionService],
})
export class PingModule {}
