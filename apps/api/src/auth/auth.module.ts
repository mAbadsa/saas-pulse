import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { AuthGuard } from './auth.guard';
import { AuthService } from './auth.service';

@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        // Refuse to start without a signing secret (missing or empty).
        const secret = config.getOrThrow<string>('JWT_SECRET');
        if (!secret.trim()) throw new Error('JWT_SECRET must not be empty');
        return {
          secret,
          signOptions: { expiresIn: config.get('JWT_EXPIRES_IN', '1d') },
        };
      },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, { provide: APP_GUARD, useClass: AuthGuard }],
})
export class AuthModule {}
