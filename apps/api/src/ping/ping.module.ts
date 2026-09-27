import { Module } from '@nestjs/common';
import { PingService } from './ping.service';

@Module({
  providers: [PingService],
  exports: [PingService],
})
export class PingModule {}
