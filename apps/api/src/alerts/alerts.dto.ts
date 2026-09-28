import type { UpdateTelegramRequest } from '@saas-pulse/shared';
import { IsBoolean } from 'class-validator';

export class UpdateTelegramDto implements UpdateTelegramRequest {
  @IsBoolean()
  enabled!: boolean;
}
