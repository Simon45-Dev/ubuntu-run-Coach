import { ForbiddenException, Injectable } from '@nestjs/common';
import { ConsentType, WorkoutType } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { AuthContext } from '../../common/auth-context';
import { Role } from '../../common/enums/role.enum';
import { buildAnalyticsSummary } from '../analytics/analytics.util';
import {
  Alert,
  detectLowReadiness,
  detectMissedTraining,
  detectPainInjury,
  detectPositiveProgress,
  detectRaceApproaching,
  detectTrainingSpike,
  sortAlerts,
} from './action-centre.util';

const DAY_MS = 24 * 60 * 60 * 1000;
// Covers both the 7-day "recent" and 14-day "baseline" readiness windows in one query.
const CHECKIN_LOOKBACK_DAYS = 21;
const VOLUME_LOOKBACK_WEEKS = 5;

/**
 * Scans a coach's whole roster for exception alerts (Section 12's Action
 * Centre) - a read-only, on-demand aggregate, not a persisted/scheduled
 * feature. See action-centre.util.ts for the actual detection logic.
 */
@Injectable()
export class ActionCentreService {
  constructor(private readonly prisma: PrismaService) {}

  async getAlertsForCoach(ctx: AuthContext, coachId: string): Promise<{ alerts: Alert[] }> {
    if (ctx.role === Role.COACH && ctx.coachId !== coachId) {
      throw new ForbiddenException();
    }

    const roster = await this.prisma.athlete.findMany({
      where: { coachId, deletedAt: null },
      include: { user: { select: { name: true } } },
    });

    const now = new Date();
    const perAthlete = await Promise.all(
      roster.map((athlete) => this.collectAlertsForAthlete(athlete.id, athlete.user.name, now)),
    );

    return { alerts: sortAlerts(perAthlete.flat()) };
  }

  private async collectAlertsForAthlete(
    athleteId: string,
    athleteName: string,
    now: Date,
  ): Promise<Alert[]> {
    const [healthAlerts, trainingAlerts, raceAlerts] = await Promise.all([
      this.getHealthAlerts(athleteId, athleteName, now),
      this.getTrainingAlerts(athleteId, athleteName, now),
      this.getRaceAlerts(athleteId, athleteName, now),
    ]);
    return [...healthAlerts, ...trainingAlerts, ...raceAlerts];
  }

  /**
   * HealthDataScopeGuard only runs on the per-athlete check-in HTTP routes -
   * this is an internal aggregate query, so the same live-consent condition
   * has to be re-checked here or CheckIn data would be exposed without it.
   */
  private async getHealthAlerts(
    athleteId: string,
    athleteName: string,
    now: Date,
  ): Promise<Alert[]> {
    const liveConsent = await this.prisma.consent.findFirst({
      where: { athleteId, consentType: ConsentType.HEALTH_CHECKIN_DATA, withdrawnAt: null },
    });
    if (!liveConsent) {
      return [];
    }

    const windowStart = new Date(now.getTime() - CHECKIN_LOOKBACK_DAYS * DAY_MS);
    const checkIns = await this.prisma.checkIn.findMany({
      where: { athleteId, deletedAt: null, date: { gte: windowStart, lte: now } },
      select: {
        date: true,
        pain: true,
        sleepQuality: true,
        energy: true,
        soreness: true,
        stress: true,
        motivation: true,
      },
    });

    return [
      ...detectPainInjury(athleteId, athleteName, checkIns, now),
      ...detectLowReadiness(athleteId, athleteName, checkIns, now),
    ];
  }

  private async getTrainingAlerts(
    athleteId: string,
    athleteName: string,
    now: Date,
  ): Promise<Alert[]> {
    const windowStart = new Date(now.getTime() - VOLUME_LOOKBACK_WEEKS * 7 * DAY_MS);
    // Same trainingPlan OR-relation shape AnalyticsService uses - a plan
    // targets this athlete directly, or a group they belong to.
    const trainingPlanFilter = {
      deletedAt: null,
      OR: [{ athleteId }, { group: { memberships: { some: { athleteId } } } }],
    };

    const workouts = await this.prisma.workout.findMany({
      where: {
        deletedAt: null,
        scheduledDate: { gte: windowStart, lte: now },
        trainingPlan: trainingPlanFilter,
      },
      select: { id: true, scheduledDate: true, type: true },
    });

    const results = await this.prisma.workoutResult.findMany({
      where: {
        athleteId,
        workout: {
          deletedAt: null,
          scheduledDate: { gte: windowStart, lte: now },
          trainingPlan: trainingPlanFilter,
        },
      },
      select: { workoutId: true, actualDistanceKm: true, actualDurationSec: true },
    });

    const missedAlerts = detectMissedTraining(athleteId, athleteName, workouts, results, now);

    const summary = buildAnalyticsSummary(
      workouts.filter((w) => w.type !== WorkoutType.REST),
      results.map((r) => ({
        workoutId: r.workoutId,
        actualDistanceKm: r.actualDistanceKm ? Number(r.actualDistanceKm) : null,
        actualDurationSec: r.actualDurationSec,
      })),
      windowStart,
      now,
    );
    const spikeAlerts = detectTrainingSpike(athleteId, athleteName, summary.weeklyTrend, now);

    return [...missedAlerts, ...spikeAlerts];
  }

  private async getRaceAlerts(athleteId: string, athleteName: string, now: Date): Promise<Alert[]> {
    const raceGoals = await this.prisma.raceGoal.findMany({
      where: { athleteId, deletedAt: null },
      select: { raceName: true, raceDate: true, status: true, updatedAt: true },
    });
    return [
      ...detectRaceApproaching(athleteId, athleteName, raceGoals, now),
      ...detectPositiveProgress(athleteId, athleteName, raceGoals, now),
    ];
  }
}
