jest.mock('bcryptjs', () => {
  const actual = jest.requireActual<typeof import('bcryptjs')>('bcryptjs');
  return {
    ...actual,
    compare: jest.fn((pw: string, hash: string) => actual.compare(pw, hash)),
  };
});

import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  const user = {
    id: 'u1',
    email: 'ana@example.com',
    name: 'Ana',
    password: bcrypt.hashSync('s3cret-pass', 4),
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  type CreateArgs = { data: { email: string; password: string } };
  let prisma: {
    user: {
      create: jest.Mock<Promise<unknown>, [CreateArgs]>;
      findUnique: jest.Mock;
    };
  };
  let service: AuthService;

  beforeEach(() => {
    prisma = {
      user: {
        create: jest.fn<Promise<unknown>, [CreateArgs]>(),
        findUnique: jest.fn(),
      },
    };
    const jwt = { signAsync: jest.fn().mockResolvedValue('token') };
    service = new AuthService(
      prisma as unknown as PrismaService,
      jwt as unknown as JwtService,
    );
  });

  describe('register', () => {
    it('stores a bcrypt hash and never returns the password', async () => {
      prisma.user.create.mockImplementation(({ data }) =>
        Promise.resolve({ ...user, ...data }),
      );

      const res = await service.register({
        email: 'ana@example.com',
        password: 's3cret-pass',
      });

      const stored = prisma.user.create.mock.calls[0][0].data.password;
      expect(stored).not.toBe('s3cret-pass');
      expect(await bcrypt.compare('s3cret-pass', stored)).toBe(true);
      expect(res.accessToken).toBe('token');
      expect(res.user).not.toHaveProperty('password');
    });

    it('maps a unique-email violation to 409', async () => {
      prisma.user.create.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('dup', {
          code: 'P2002',
          clientVersion: 'x',
        }),
      );

      await expect(
        service.register({ email: 'ana@example.com', password: 's3cret-pass' }),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('login', () => {
    it('returns a token for the right password', async () => {
      prisma.user.findUnique.mockResolvedValue(user);

      const res = await service.login({
        email: 'ana@example.com',
        password: 's3cret-pass',
      });

      expect(res).toEqual({
        accessToken: 'token',
        user: { id: 'u1', email: 'ana@example.com', name: 'Ana' },
      });
    });

    it('fails identically for a wrong password and an unknown email', async () => {
      const compare = bcrypt.compare as jest.Mock;
      compare.mockClear();

      prisma.user.findUnique.mockResolvedValue(user);
      const wrong = service.login({ email: user.email, password: 'nope-nope' });
      await expect(wrong).rejects.toThrow(
        new UnauthorizedException('Invalid email or password'),
      );

      prisma.user.findUnique.mockResolvedValue(null);
      const unknown = service.login({
        email: 'x@example.com',
        password: 'nope-nope',
      });
      await expect(unknown).rejects.toThrow(
        new UnauthorizedException('Invalid email or password'),
      );

      // Still hashes for unknown emails, so timing doesn't reveal account existence.
      expect(compare).toHaveBeenCalledTimes(2);
    });
  });
});
