import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { UserStatus } from '../../common/enums/user-status.enum';
import { bucketWeeklySignups } from './platform-stats.util';

const SIGNUP_WEEKS = 8;

@Injectable()
export class PlatformStatsService {
  constructor(private readonly prisma: PrismaService) {}

  async getStats() {
    const now = new Date();
    const windowStart = new Date(now);
    windowStart.setUTCDate(windowStart.getUTCDate() - SIGNUP_WEEKS * 7);

    const [
      organisations,
      coaches,
      athletes,
      activeUsers,
      invitedUsers,
      suspendedUsers,
      deactivatedUsers,
      recentOrganisations,
      usersInWindow,
      organisationsInWindow,
    ] = await Promise.all([
      this.prisma.organisation.count({ where: { deletedAt: null } }),
      this.prisma.coach.count({ where: { deletedAt: null } }),
      this.prisma.athlete.count({ where: { deletedAt: null } }),
      this.prisma.user.count({ where: { status: UserStatus.ACTIVE, deletedAt: null } }),
      this.prisma.user.count({ where: { status: UserStatus.INVITED, deletedAt: null } }),
      this.prisma.user.count({ where: { status: UserStatus.SUSPENDED, deletedAt: null } }),
      this.prisma.user.count({ where: { status: UserStatus.DEACTIVATED, deletedAt: null } }),
      this.prisma.organisation.findMany({
        where: { deletedAt: null },
        select: { id: true, name: true, type: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
      this.prisma.user.findMany({
        where: { createdAt: { gte: windowStart }, deletedAt: null },
        select: { createdAt: true },
      }),
      this.prisma.organisation.findMany({
        where: { createdAt: { gte: windowStart }, deletedAt: null },
        select: { createdAt: true },
      }),
    ]);

    return {
      totals: {
        organisations,
        coaches,
        athletes,
        usersByStatus: {
          ACTIVE: activeUsers,
          INVITED: invitedUsers,
          SUSPENDED: suspendedUsers,
          DEACTIVATED: deactivatedUsers,
        },
      },
      weeklySignups: bucketWeeklySignups(
        usersInWindow.map((u) => u.createdAt),
        organisationsInWindow.map((o) => o.createdAt),
        SIGNUP_WEEKS,
        now,
      ),
      recentOrganisations,
    };
  }
}
