import { SetMetadata } from '@nestjs/common';

export const SCOPE_RESOURCE_KEY = 'scopeResource';

export type ScopeResourceType = 'organisation' | 'coach' | 'athlete';

/**
 * Marks which resource type a route's `:id`-style param refers to, so
 * OrgScopeGuard can reject an obvious cross-scope request (e.g. an athlete
 * token requesting a different athleteId) before it reaches the service
 * layer. Checks that require a DB lookup (e.g. "is this athlete on this
 * coach's roster") are left to the service layer's scope-filtered query -
 * this guard only catches the checks answerable from the JWT claims alone.
 */
export const ScopeResource = (type: ScopeResourceType, paramName = 'id') =>
  SetMetadata(SCOPE_RESOURCE_KEY, { type, paramName });
