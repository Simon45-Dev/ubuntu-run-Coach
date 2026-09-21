import { ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AuthContext } from '../auth-context';

/**
 * Validates the JWT access token via JwtStrategy and attaches the resulting
 * AuthContext to the request as `authContext` (read by @CurrentUser,
 * RolesGuard, OrgScopeGuard). Every route except /health and
 * /auth/register|login|refresh must sit behind this guard.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  handleRequest<TUser = AuthContext>(
    err: unknown,
    user: TUser | false,
    _info: unknown,
    context: ExecutionContext,
  ): TUser {
    if (err || !user) {
      throw err instanceof Error ? err : new UnauthorizedException();
    }
    const request = context.switchToHttp().getRequest();
    request.authContext = user;
    return user;
  }
}
