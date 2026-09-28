import type { StatsRange } from '@saas-pulse/shared';
import { IsIn, IsOptional } from 'class-validator';

export class StatsQueryDto {
  @IsOptional()
  @IsIn(['24h', '7d'])
  range: StatsRange = '24h';
}
