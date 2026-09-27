import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import type { UserProfile } from '@saas-pulse/shared';
import { CurrentUser } from '../auth/auth.decorators';
import { CreateMonitorDto, UpdateMonitorDto } from './monitors.dto';
import { MonitorsService } from './monitors.service';

@Controller('monitors')
export class MonitorsController {
  constructor(private readonly monitors: MonitorsService) {}

  @Post()
  create(@CurrentUser() user: UserProfile, @Body() dto: CreateMonitorDto) {
    return this.monitors.create(user.id, dto);
  }

  @Get()
  findAll(@CurrentUser() user: UserProfile) {
    return this.monitors.findAll(user.id);
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
