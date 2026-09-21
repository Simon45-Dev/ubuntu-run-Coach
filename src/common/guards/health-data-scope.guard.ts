import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../database/prisma.service';
import { OrgScopeGuard } from './org-scope.guard';
import { SCOPE_RESOURCE_KEY, ScopeResourceType } from '../decorators/scope-resource.decorator';
import { AuthContext } from '../auth-context';
import { Role } from '../enums/role.enum';

/**
 * Stricter guard for health-adjacent personal information (CheckIn data:
 * sleep, soreness, stress, pain). Applies every rule OrgScopeGuard applies,
 * PLUS requires a live (non-withdrawn) Consent row for the target athlete.
 * Kept as its own named class - rather than a flag on OrgScopeGuard - so
 * routes touching this data category are visually distinct in code review,
 * per the product plan's requirement that health data get handling stricter
 * than ordinary training data.
 *
 * No CheckIn API exists yet in this slice; this guard exists now as a
 * tested, ready-to-apply building block for when that module is built.
 */
@Injectable()
export class HealthDataScopeGuard extends OrgScopeGuard implements CanActivate {
  constructor(
    reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {
    super(reflector);
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const baseAllowed = await super.canActivate(context);
    if (!baseAllowed) {
      return false;
    }

    const request = context.switchToHttp().getRequest();
    const authContext: AuthContext | undefined = request.authContext;
    if (!authContext) {
      throw new ForbiddenException('Missing auth context');
    }
    if (authContext.role === Role.PLATFORM_ADMIN) {
      return true;
    }

    const meta = this.reflector.getAllAndOverride<
      { type: ScopeResourceType; paramName: string } | undefined
    >(SCOPE_RESOURCE_KEY, [context.getHandler(), context.getClass()]);

    const athleteId =
      meta?.type === 'athlete' ? request.params?.[meta.paramName] : authContext.athleteId;

    if (!athleteId) {
      return true;
    }

    const liveConsent = await this.prisma.consent.findFirst({
      where: {
        athleteId,
        consentType: 'HEALTH_CHECKIN_DATA',
        withdrawnAt: null,
      },
    });

    if (!liveConsent) {
      throw new ForbiddenException('No active consent on record for health check-in data');
    }

    return true;
  }
}
