import { Module } from '@nestjs/common';
import { CheckRetentionService } from './check-retention.service';
import { PingService } from './ping.service';

@Module({
  providers: [PingService, CheckRetentionService],
  exports: [PingService, CheckRetentionService],
})
export class PingModule {}
