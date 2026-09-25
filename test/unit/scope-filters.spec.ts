import {
  buildAthleteScopeFilter,
  buildClubMemberScopeFilter,
  buildCoachScopeFilter,
  buildOrgScopeFilter,
  buildTrainingPlanScopeFilter,
} from '../../src/common/scope/scope-filters';
import { Role } from '../../src/common/enums/role.enum';
import { AuthContext } from '../../src/common/auth-context';

describe('scope-filters', () => {
  describe('buildAthleteScopeFilter', () => {
    it('PLATFORM_ADMIN gets no restriction', () => {
      const ctx: AuthContext = { userId: 'u1', role: Role.PLATFORM_ADMIN };
      expect(buildAthleteScopeFilter(ctx)).toEqual({});
    });

    it('COACH is scoped to their own coachId', () => {
      const ctx: AuthContext = { userId: 'u1', role: Role.COACH, coachId: 'coach-1' };
      expect(buildAthleteScopeFilter(ctx)).toEqual({ coachId: 'coach-1' });
    });

    it('COACH without a coachId throws (malformed context, not a valid scope)', () => {
      const ctx: AuthContext = { userId: 'u1', role: Role.COACH };
      expect(() => buildAthleteScopeFilter(ctx)).toThrow();
    });

    it('ATHLETE is scoped to their own id only', () => {
      const ctx: AuthContext = { userId: 'u1', role: Role.ATHLETE, athleteId: 'athlete-1' };
      expect(buildAthleteScopeFilter(ctx)).toEqual({ id: 'athlete-1' });
    });

    it('ATHLETE without an athleteId throws', () => {
      const ctx: AuthContext = { userId: 'u1', role: Role.ATHLETE };
      expect(() => buildAthleteScopeFilter(ctx)).toThrow();
    });
  });

  describe('buildClubMemberScopeFilter', () => {
    it('PLATFORM_ADMIN gets no restriction', () => {
      const ctx: AuthContext = { userId: 'u1', role: Role.PLATFORM_ADMIN };
      expect(buildClubMemberScopeFilter(ctx)).toEqual({});
    });

    it('COACH is scoped to their own organisationId, not a specific coachId', () => {
      const ctx: AuthContext = { userId: 'u1', role: Role.COACH, organisationId: 'org-1' };
      expect(buildClubMemberScopeFilter(ctx)).toEqual({ organisationId: 'org-1' });
    });

    it('COACH without an organisationId throws', () => {
      const ctx: AuthContext = { userId: 'u1', role: Role.COACH };
      expect(() => buildClubMemberScopeFilter(ctx)).toThrow();
    });

    it('CLUB_MEMBER is scoped to their own id only', () => {
      const ctx: AuthContext = { userId: 'u1', role: Role.CLUB_MEMBER, clubMemberId: 'member-1' };
      expect(buildClubMemberScopeFilter(ctx)).toEqual({ id: 'member-1' });
    });

    it('CLUB_MEMBER without a clubMemberId throws', () => {
      const ctx: AuthContext = { userId: 'u1', role: Role.CLUB_MEMBER };
      expect(() => buildClubMemberScopeFilter(ctx)).toThrow();
    });

    it('ATHLETE has no access', () => {
      const ctx: AuthContext = { userId: 'u1', role: Role.ATHLETE, athleteId: 'athlete-1' };
      expect(() => buildClubMemberScopeFilter(ctx)).toThrow();
    });
  });

  describe('buildOrgScopeFilter', () => {
    it('PLATFORM_ADMIN gets no restriction', () => {
      const ctx: AuthContext = { userId: 'u1', role: Role.PLATFORM_ADMIN };
      expect(buildOrgScopeFilter(ctx)).toEqual({});
    });

    it('COACH is scoped to their own organisationId', () => {
      const ctx: AuthContext = { userId: 'u1', role: Role.COACH, organisationId: 'org-1' };
      expect(buildOrgScopeFilter(ctx)).toEqual({ organisationId: 'org-1' });
    });

    it('ATHLETE is scoped to their own organisationId', () => {
      const ctx: AuthContext = { userId: 'u1', role: Role.ATHLETE, organisationId: 'org-1' };
      expect(buildOrgScopeFilter(ctx)).toEqual({ organisationId: 'org-1' });
    });
  });

  describe('buildCoachScopeFilter', () => {
    it('COACH is scoped to their own coach id', () => {
      const ctx: AuthContext = { userId: 'u1', role: Role.COACH, coachId: 'coach-1' };
      expect(buildCoachScopeFilter(ctx)).toEqual({ id: 'coach-1' });
    });

    it('ATHLETE is scoped to their assigned coach id', () => {
      const ctx: AuthContext = { userId: 'u1', role: Role.ATHLETE, coachId: 'coach-1' };
      expect(buildCoachScopeFilter(ctx)).toEqual({ id: 'coach-1' });
    });

    it('ATHLETE with no assigned coach throws', () => {
      const ctx: AuthContext = { userId: 'u1', role: Role.ATHLETE };
      expect(() => buildCoachScopeFilter(ctx)).toThrow();
    });
  });

  describe('buildTrainingPlanScopeFilter', () => {
    it('PLATFORM_ADMIN gets no restriction', () => {
      const ctx: AuthContext = { userId: 'u1', role: Role.PLATFORM_ADMIN };
      expect(buildTrainingPlanScopeFilter(ctx)).toEqual({});
    });

    it('COACH is scoped to plans they own', () => {
      const ctx: AuthContext = { userId: 'u1', role: Role.COACH, coachId: 'coach-1' };
      expect(buildTrainingPlanScopeFilter(ctx)).toEqual({ coachId: 'coach-1' });
    });

    it('COACH without a coachId throws', () => {
      const ctx: AuthContext = { userId: 'u1', role: Role.COACH };
      expect(() => buildTrainingPlanScopeFilter(ctx)).toThrow();
    });

    it('ATHLETE is scoped to plans assigned to them directly, or to a group they belong to', () => {
      const ctx: AuthContext = { userId: 'u1', role: Role.ATHLETE, athleteId: 'athlete-1' };
      expect(buildTrainingPlanScopeFilter(ctx)).toEqual({
        OR: [
          { athleteId: 'athlete-1' },
          { group: { memberships: { some: { athleteId: 'athlete-1' } } } },
        ],
      });
    });

    it('ATHLETE without an athleteId throws', () => {
      const ctx: AuthContext = { userId: 'u1', role: Role.ATHLETE };
      expect(() => buildTrainingPlanScopeFilter(ctx)).toThrow();
    });
  });
});
