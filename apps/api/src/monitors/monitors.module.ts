import { Module } from '@nestjs/common';
import { MonitorsController } from './monitors.controller';
import { MonitorsService } from './monitors.service';
import { StatsService } from './stats.service';
import { SocketModule } from '../socket/socket.module';

@Module({
  imports: [SocketModule],
  controllers: [MonitorsController],
  providers: [MonitorsService, StatsService],
})
export class MonitorsModule {}
