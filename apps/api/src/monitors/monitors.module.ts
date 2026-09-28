import { Module } from '@nestjs/common';
import { MonitorsController } from './monitors.controller';
import { MonitorsService } from './monitors.service';
import { StatsService } from './stats.service';

@Module({
  controllers: [MonitorsController],
  providers: [MonitorsService, StatsService],
})
export class MonitorsModule {}
