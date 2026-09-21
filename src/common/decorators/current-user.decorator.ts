import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AuthContext } from '../auth-context';

/** Pulls the AuthContext attached to the request by JwtAuthGuard. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthContext => {
    const request = ctx.switchToHttp().getRequest();
    return request.authContext;
  },
);
