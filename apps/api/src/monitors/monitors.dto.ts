import type {
  CreateMonitorRequest,
  UpdateMonitorRequest,
} from '@saas-pulse/shared';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Length,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

// http(s) only, absolute, no user:pass@. localhost is allowed for local dev;
// blocking private addresses is the ping service's job (checked at request time).
const URL_OPTIONS = {
  protocols: ['http', 'https'],
  require_protocol: true,
  require_valid_protocol: true,
  require_tld: false,
  disallow_auth: true,
};

export class CreateMonitorDto implements CreateMonitorRequest {
  @Transform(trim)
  @IsString()
  @Length(1, 100)
  name!: string;

  @Transform(trim)
  @IsUrl(URL_OPTIONS)
  @MaxLength(2048)
  url!: string;

  @IsOptional()
  @IsInt()
  @Min(30)
  @Max(86400)
  intervalSeconds?: number;
}

export class UpdateMonitorDto implements UpdateMonitorRequest {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @Length(1, 100)
  name?: string;

  @IsOptional()
  @Transform(trim)
  @IsUrl(URL_OPTIONS)
  @MaxLength(2048)
  url?: string;

  @IsOptional()
  @IsInt()
  @Min(30)
  @Max(86400)
  intervalSeconds?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
