import { Role } from './enums/role.enum';

/**
 * Derived once per request from the validated JWT payload. Every service
 * method that touches org- or athlete-scoped data takes this as its first
 * argument so the scoping rule is enforced at the query, not just the route.
 */
export interface AuthContext {
  userId: string;
  role: Role;
  organisationId?: string;
  coachId?: string;
  athleteId?: string;
}
