import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SCOPE_RESOURCE_KEY, ScopeResourceType } from '../decorators/scope-resource.decorator';
import { Role } from '../enums/role.enum';
import { AuthContext } from '../auth-context';

/**
 * First line of defence for data isolation. Rejects a request early when the
 * route's :id param obviously doesn't match the caller's own scope, judged
 * purely from JWT claims (no DB round trip). This deliberately does NOT
 * resolve "is this athlete on this coach's roster" - that check requires a
 * DB lookup and is enforced by the service layer via buildAthleteScopeFilter
 * (src/common/scope/scope-filters.ts), which returns 404 rather than 403 for
 * an out-of-scope id so existence isn't leaked to a caller who shouldn't see
 * it either way.
 */
@Injectable()
export class OrgScopeGuard implements CanActivate {
  constructor(protected readonly reflector: Reflector) {}

  // Declared as boolean | Promise<boolean> (rather than just boolean) so
  // HealthDataScopeGuard can override with an async implementation - it
  // needs a DB lookup (a live Consent check) that this base class doesn't.
  canActivate(context: ExecutionContext): boolean | Promise<boolean> {
    const meta = this.reflector.getAllAndOverride<
      { type: ScopeResourceType; paramName: string } | undefined
    >(SCOPE_RESOURCE_KEY, [context.getHandler(), context.getClass()]);

    if (!meta) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const authContext: AuthContext | undefined = request.authContext;
    if (!authContext) {
      throw new ForbiddenException('Missing auth context');
    }

    if (authContext.role === Role.PLATFORM_ADMIN) {
      return true;
    }

    const paramValue = request.params?.[meta.paramName];
    if (!paramValue) {
      // No concrete id in this route (e.g. a list endpoint) - nothing to
      // check at this layer; the service layer applies the scope filter.
      return true;
    }

    switch (meta.type) {
      case 'organisation':
        if (authContext.organisationId !== paramValue) {
          throw new ForbiddenException('Organisation scope mismatch');
        }
        return true;
      case 'coach':
        if (authContext.role === Role.COACH && authContext.coachId !== paramValue) {
          throw new ForbiddenException('Coach scope mismatch');
        }
        // ATHLETE requesting a :coachId route is left to the service layer
        // (e.g. must equal their own assigned coach) since that's still a
        // direct claim comparison there, not a DB lookup.
        if (authContext.role === Role.ATHLETE && authContext.coachId !== paramValue) {
          throw new ForbiddenException('Coach scope mismatch');
        }
        return true;
      case 'athlete':
        if (authContext.role === Role.ATHLETE && authContext.athleteId !== paramValue) {
          throw new ForbiddenException('Athlete scope mismatch');
        }
        // COACH requesting a specific :athleteId is left to the service
        // layer's roster-membership check (requires a DB lookup).
        return true;
      default:
        return true;
    }
  }
}
