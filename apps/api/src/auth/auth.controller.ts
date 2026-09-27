import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
import type { AuthResponse, UserProfile } from '@saas-pulse/shared';
import { CurrentUser, Public } from './auth.decorators';
import { LoginDto, RegisterDto } from './auth.dto';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('register')
  register(@Body() dto: RegisterDto): Promise<AuthResponse> {
    return this.authService.register(dto);
  }

  @Public()
  @Post('login')
  @HttpCode(200)
  login(@Body() dto: LoginDto): Promise<AuthResponse> {
    return this.authService.login(dto);
  }

  @Get('me')
  me(@CurrentUser() user: UserProfile): UserProfile {
    return user;
  }
}
