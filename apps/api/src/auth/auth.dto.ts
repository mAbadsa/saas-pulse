import type { LoginRequest, RegisterRequest } from '@saas-pulse/shared';
import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  MinLength,
  ValidateBy,
} from 'class-validator';

const normalizeEmail = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;

// bcrypt ignores everything past 72 bytes; reject instead of silently truncating.
const MaxBytes = (max: number) =>
  ValidateBy({
    name: 'maxBytes',
    validator: {
      validate: (value) =>
        typeof value === 'string' && Buffer.byteLength(value, 'utf8') <= max,
      defaultMessage: (args) =>
        `${args?.property} must be at most ${max} bytes`,
    },
  });

export class RegisterDto implements RegisterRequest {
  @Transform(normalizeEmail)
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  @MaxBytes(72)
  password!: string;

  @IsOptional()
  @IsString()
  @Length(1, 100)
  name?: string;
}

export class LoginDto implements LoginRequest {
  @Transform(normalizeEmail)
  @IsEmail()
  email!: string;

  @IsString()
  @IsNotEmpty()
  password!: string;
}
