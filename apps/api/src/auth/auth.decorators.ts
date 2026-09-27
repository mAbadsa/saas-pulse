import {
  createParamDecorator,
  ExecutionContext,
  SetMetadata,
} from '@nestjs/common';
import type { UserProfile } from '@saas-pulse/shared';

export const IS_PUBLIC_KEY = 'isPublic';

/** Opt a route or controller out of the global AuthGuard. */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

/** The signed-in user, attached to the request by AuthGuard. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): UserProfile =>
    ctx.switchToHttp().getRequest<{ user: UserProfile }>().user,
);
