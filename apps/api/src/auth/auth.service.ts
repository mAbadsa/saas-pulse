import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Prisma, type User } from '@prisma/client';
import type { AuthResponse } from '@saas-pulse/shared';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto, RegisterDto } from './auth.dto';

const BCRYPT_COST = 10;
// Compared against when the email is unknown, so failed logins take the same time either way.
const DUMMY_HASH = bcrypt.hashSync('dummy-password', BCRYPT_COST);

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async register(dto: RegisterDto): Promise<AuthResponse> {
    const password = await bcrypt.hash(dto.password, BCRYPT_COST);
    try {
      const user = await this.prisma.user.create({
        data: { email: dto.email, name: dto.name, password },
      });
      return this.issue(user);
    } catch (e) {
      // Unique constraint on email: also correct when two registrations race.
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        throw new ConflictException('Email already in use');
      }
      throw e;
    }
  }

  async login(dto: LoginDto): Promise<AuthResponse> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    const ok = await bcrypt.compare(dto.password, user?.password ?? DUMMY_HASH);
    if (!user || !ok) {
      throw new UnauthorizedException('Invalid email or password');
    }
    return this.issue(user);
  }

  private async issue(user: User): Promise<AuthResponse> {
    return {
      accessToken: await this.jwt.signAsync({ sub: user.id }),
      user: { id: user.id, email: user.email, name: user.name },
    };
  }
}
