import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AuthContext } from '../../common/auth-context';
import { Role } from '../../common/enums/role.enum';
import { CreateGroupDto } from './dto/create-group.dto';
import { UpdateGroupDto } from './dto/update-group.dto';
import { AddGroupMemberDto } from './dto/add-group-member.dto';

const GROUP_INCLUDE = {
  memberships: {
    include: { athlete: { include: { user: { select: { id: true, name: true } } } } },
  },
};

@Injectable()
export class GroupsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Route is @Roles(COACH, PLATFORM_ADMIN) - ATHLETE never reaches here. */
  async create(ctx: AuthContext, coachId: string, dto: CreateGroupDto) {
    if (ctx.role === Role.COACH && ctx.coachId !== coachId) {
      throw new ForbiddenException();
    }
    const coach = await this.prisma.coach.findFirst({ where: { id: coachId, deletedAt: null } });
    if (!coach) {
      throw new NotFoundException('Coach not found');
    }
    return this.prisma.group.create({
      data: { coachId, organisationId: coach.organisationId, name: dto.name },
      include: GROUP_INCLUDE,
    });
  }

  /** Own roster only - a coach never sees another coach's groups. */
  async findAllForCoach(ctx: AuthContext, coachId: string) {
    if (ctx.role === Role.COACH && ctx.coachId !== coachId) {
      throw new ForbiddenException();
    }
    return this.prisma.group.findMany({
      where: { coachId, deletedAt: null },
      include: GROUP_INCLUDE,
    });
  }

  /** Owning coach, a member athlete, or PLATFORM_ADMIN - the isolation boundary for this resource. */
  async findOne(ctx: AuthContext, id: string) {
    const group = await this.prisma.group.findFirst({
      where: { id, deletedAt: null },
      include: GROUP_INCLUDE,
    });
    if (!group) {
      throw new NotFoundException('Group not found');
    }
    if (ctx.role === Role.PLATFORM_ADMIN) {
      return group;
    }
    if (ctx.role === Role.COACH && group.coachId === ctx.coachId) {
      return group;
    }
    if (ctx.role === Role.ATHLETE && group.memberships.some((m) => m.athleteId === ctx.athleteId)) {
      return group;
    }
    // 404, not 403: an out-of-scope group's existence isn't confirmed to a
    // caller who isn't its coach and isn't a member.
    throw new NotFoundException('Group not found');
  }

  /** Route is @Roles(COACH, PLATFORM_ADMIN) - ATHLETE never reaches here. */
  async update(ctx: AuthContext, id: string, dto: UpdateGroupDto) {
    const group = await this.findOne(ctx, id);
    return this.prisma.group.update({
      where: { id: group.id },
      data: { name: dto.name },
      include: GROUP_INCLUDE,
    });
  }

  /**
   * Route is @Roles(COACH, PLATFORM_ADMIN). Does not cascade to the group's
   * training plans - matches AthletesService.softDelete's precedent of
   * keeping training history intact when the roster relationship ends.
   */
  async softDelete(ctx: AuthContext, id: string): Promise<void> {
    const group = await this.findOne(ctx, id);
    await this.prisma.group.update({
      where: { id: group.id },
      data: { deletedAt: new Date() },
    });
  }

  /** Route is @Roles(COACH, PLATFORM_ADMIN). The athlete must be on this same coach's roster. */
  async addMember(ctx: AuthContext, groupId: string, dto: AddGroupMemberDto) {
    const group = await this.findOne(ctx, groupId);
    const athlete = await this.prisma.athlete.findFirst({
      where: { id: dto.athleteId, deletedAt: null, coachId: group.coachId },
    });
    if (!athlete) {
      throw new NotFoundException('Athlete not found');
    }
    await this.prisma.groupMembership.upsert({
      where: { groupId_athleteId: { groupId: group.id, athleteId: athlete.id } },
      create: { groupId: group.id, athleteId: athlete.id },
      update: {},
    });
    return this.findOne(ctx, groupId);
  }

  /** Route is @Roles(COACH, PLATFORM_ADMIN). */
  async removeMember(ctx: AuthContext, groupId: string, athleteId: string) {
    const group = await this.findOne(ctx, groupId);
    await this.prisma.groupMembership.deleteMany({
      where: { groupId: group.id, athleteId },
    });
    return this.findOne(ctx, groupId);
  }
}
