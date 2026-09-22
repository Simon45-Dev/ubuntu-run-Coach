import { ForbiddenException } from '@nestjs/common';
import { Role } from '../enums/role.enum';
import { AuthContext } from '../auth-context';

/**
 * Centralised, unit-tested scoping rules. Every service method touching
 * athlete- or org-scoped data must build its Prisma `where` clause through
 * these helpers rather than trusting a route param directly - this is the
 * one place the "athlete never sees another athlete's data" and "coach
 * never sees another coach's roster" rules actually live.
 */

/**
 * Scopes an Athlete query to what the caller is allowed to see:
 * - PLATFORM_ADMIN: unrestricted
 * - COACH: only athletes on their own roster (not other coaches' athletes,
 *   even within the same organisation)
 * - ATHLETE: only their own record
 */
export function buildAthleteScopeFilter(ctx: AuthContext): Record<string, unknown> {
  switch (ctx.role) {
    case Role.PLATFORM_ADMIN:
      return {};
    case Role.COACH:
      if (!ctx.coachId) {
        throw new ForbiddenException('Coach context missing coachId');
      }
      return { coachId: ctx.coachId };
    case Role.ATHLETE:
      if (!ctx.athleteId) {
        throw new ForbiddenException('Athlete context missing athleteId');
      }
      return { id: ctx.athleteId };
    default:
      throw new ForbiddenException('Unknown role');
  }
}

/**
 * Scopes an organisation-scoped query (Organisation, Coach, Subscription):
 * - PLATFORM_ADMIN: unrestricted
 * - COACH / ATHLETE: only their own organisation
 */
export function buildOrgScopeFilter(ctx: AuthContext): Record<string, unknown> {
  if (ctx.role === Role.PLATFORM_ADMIN) {
    return {};
  }
  if (!ctx.organisationId) {
    throw new ForbiddenException('Missing organisationId in auth context');
  }
  return { organisationId: ctx.organisationId };
}

/**
 * Scopes a TrainingPlan query to what the caller is allowed to see:
 * - PLATFORM_ADMIN: unrestricted
 * - COACH: only plans they own (their own coachId - true regardless of
 *   whether a plan targets one athlete or a whole group, since coachId is
 *   always set either way)
 * - ATHLETE: plans assigned directly to them, OR assigned to a group they're
 *   a member of - a single relational OR clause, not two separate queries
 *
 * Note: unlike buildAthleteScopeFilter, the ATHLETE case here returns
 * `{ athleteId: ... }` rather than `{ id: ... }` - TrainingPlan has an
 * athleteId FK column, it isn't the Athlete table's own PK.
 */
export function buildTrainingPlanScopeFilter(ctx: AuthContext): Record<string, unknown> {
  switch (ctx.role) {
    case Role.PLATFORM_ADMIN:
      return {};
    case Role.COACH:
      if (!ctx.coachId) {
        throw new ForbiddenException('Coach context missing coachId');
      }
      return { coachId: ctx.coachId };
    case Role.ATHLETE:
      if (!ctx.athleteId) {
        throw new ForbiddenException('Athlete context missing athleteId');
      }
      return {
        OR: [
          { athleteId: ctx.athleteId },
          { group: { memberships: { some: { athleteId: ctx.athleteId } } } },
        ],
      };
    default:
      throw new ForbiddenException('Unknown role');
  }
}

/**
 * Scopes a Coach-record query specifically (id field, not organisationId):
 * - PLATFORM_ADMIN: unrestricted
 * - COACH: only their own coach record
 * - ATHLETE: only their assigned coach's record
 */
export function buildCoachScopeFilter(ctx: AuthContext): Record<string, unknown> {
  switch (ctx.role) {
    case Role.PLATFORM_ADMIN:
      return {};
    case Role.COACH:
      if (!ctx.coachId) {
        throw new ForbiddenException('Coach context missing coachId');
      }
      return { id: ctx.coachId };
    case Role.ATHLETE:
      if (!ctx.coachId) {
        throw new ForbiddenException('Athlete has no assigned coach');
      }
      return { id: ctx.coachId };
    default:
      throw new ForbiddenException('Unknown role');
  }
}
