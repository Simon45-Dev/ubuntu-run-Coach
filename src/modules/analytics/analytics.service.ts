import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { WorkoutType } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { AuthContext } from '../../common/auth-context';
import { buildAthleteScopeFilter } from '../../common/scope/scope-filters';
import { AnalyticsQueryDto } from './dto/analytics-query.dto';
import { buildAnalyticsSummary } from './analytics.util';

const EIGHT_WEEKS_MS = 8 * 7 * 24 * 60 * 60 * 1000;

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async getSummary(ctx: AuthContext, athleteId: string, query: AnalyticsQueryDto) {
    const athlete = await this.prisma.athlete.findFirst({
      where: { id: athleteId, deletedAt: null, ...buildAthleteScopeFilter(ctx) },
    });
    if (!athlete) {
      throw new NotFoundException('Athlete not found');
    }

    const to = query.to ? new Date(query.to) : new Date();
    const from = query.from ? new Date(query.from) : new Date(to.getTime() - EIGHT_WEEKS_MS);
    if (from > to) {
      throw new BadRequestException('from must not be after to');
    }

    const trainingPlanFilter = {
      deletedAt: null,
      OR: [{ athleteId }, { group: { memberships: { some: { athleteId } } } }],
    };

    const workouts = await this.prisma.workout.findMany({
      where: {
        deletedAt: null,
        type: { not: WorkoutType.REST },
        scheduledDate: { gte: from, lte: to },
        trainingPlan: trainingPlanFilter,
      },
      select: { id: true, scheduledDate: true, distanceTargetKm: true, rpeTarget: true },
    });

    const results = await this.prisma.workoutResult.findMany({
      where: {
        athleteId,
        workout: {
          deletedAt: null,
          type: { not: WorkoutType.REST },
          scheduledDate: { gte: from, lte: to },
          trainingPlan: trainingPlanFilter,
        },
      },
      select: { workoutId: true, actualDistanceKm: true, actualDurationSec: true, rpe: true },
    });

    return buildAnalyticsSummary(
      workouts.map((w) => ({
        id: w.id,
        scheduledDate: w.scheduledDate,
        distanceTargetKm: w.distanceTargetKm ? Number(w.distanceTargetKm) : null,
        rpeTarget: w.rpeTarget,
      })),
      results.map((r) => ({
        workoutId: r.workoutId,
        actualDistanceKm: r.actualDistanceKm ? Number(r.actualDistanceKm) : null,
        actualDurationSec: r.actualDurationSec,
        rpe: r.rpe,
      })),
      from,
      to,
    );
  }
}
