import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import type { UserProfile } from '@saas-pulse/shared';
import { CurrentUser } from '../auth/auth.decorators';
import { CreateMonitorDto, UpdateMonitorDto } from './monitors.dto';
import { MonitorsService } from './monitors.service';
import { StatsQueryDto } from './stats.dto';
import { StatsService } from './stats.service';

@Controller('monitors')
export class MonitorsController {
  constructor(
    private readonly monitors: MonitorsService,
    private readonly stats: StatsService,
  ) {}

  @Post()
  create(@CurrentUser() user: UserProfile, @Body() dto: CreateMonitorDto) {
    return this.monitors.create(user.id, dto);
  }

  @Get()
  findAll(@CurrentUser() user: UserProfile) {
    return this.monitors.findAll(user.id);
  }

  // Declared before ':id' so "stats" isn't captured as an id.
  @Get('stats')
  summary(@CurrentUser() user: UserProfile) {
    return this.stats.summaryForUser(user.id);
  }

  @Get(':id/stats')
  detail(
    @CurrentUser() user: UserProfile,
    @Param('id') id: string,
    @Query() query: StatsQueryDto,
  ) {
    return this.stats.detail(id, user.id, query.range);
  }

  @Get(':id')
  findOne(@CurrentUser() user: UserProfile, @Param('id') id: string) {
    return this.monitors.findOne(id, user.id);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: UserProfile,
    @Param('id') id: string,
    @Body() dto: UpdateMonitorDto,
  ) {
    return this.monitors.update(id, user.id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@CurrentUser() user: UserProfile, @Param('id') id: string) {
    return this.monitors.remove(id, user.id);
  }
}
