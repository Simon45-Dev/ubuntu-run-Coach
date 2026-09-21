import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import * as argon2 from 'argon2';
import { PrismaService } from '../../database/prisma.service';
import { AuthContext } from '../../common/auth-context';
import { Role } from '../../common/enums/role.enum';
import { UserStatus } from '../../common/enums/user-status.enum';
import { CreateCoachDto } from './dto/create-coach.dto';
import { UpdateCoachDto } from './dto/update-coach.dto';

const COACH_INCLUDE = { user: { select: { id: true, email: true, name: true, status: true } } };

@Injectable()
export class CoachesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * PLATFORM_ADMIN only in this slice. The API accepts any organisationId so
   * a second coach can be added to an existing organisation, even though no
   * v1 UI exposes that yet (see the multi-coach scope decision).
   */
  async create(organisationId: string, dto: CreateCoachDto) {
    const org = await this.prisma.organisation.findFirst({
      where: { id: organisationId, deletedAt: null },
    });
    if (!org) {
      throw new NotFoundException('Organisation not found');
    }

    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) {
      throw new ForbiddenException('An account with this email already exists');
    }

    const passwordHash = await argon2.hash(dto.password);
    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: dto.email,
          passwordHash,
          name: dto.name,
          role: Role.COACH,
          status: UserStatus.ACTIVE,
        },
      });
      return tx.coach.create({
        data: {
          userId: user.id,
          organisationId,
          bio: dto.bio,
          experienceYears: dto.experienceYears,
        },
        include: COACH_INCLUDE,
      });
    });
  }

  async findAllForOrganisation(ctx: AuthContext, organisationId: string) {
    if (ctx.role !== Role.PLATFORM_ADMIN && ctx.organisationId !== organisationId) {
      throw new ForbiddenException();
    }
    return this.prisma.coach.findMany({
      where: { organisationId, deletedAt: null },
      include: COACH_INCLUDE,
    });
  }

  async findOne(ctx: AuthContext, id: string) {
    const coach = await this.prisma.coach.findFirst({
      where: { id, deletedAt: null },
      include: COACH_INCLUDE,
    });
    if (!coach) {
      throw new NotFoundException('Coach not found');
    }
    if (ctx.role !== Role.PLATFORM_ADMIN && ctx.organisationId !== coach.organisationId) {
      throw new NotFoundException('Coach not found');
    }
    return coach;
  }

  async update(ctx: AuthContext, id: string, dto: UpdateCoachDto) {
    const coach = await this.findOne(ctx, id);
    if (ctx.role === Role.COACH && ctx.coachId !== id) {
      throw new ForbiddenException();
    }
    return this.prisma.coach.update({
      where: { id: coach.id },
      data: dto,
      include: COACH_INCLUDE,
    });
  }

  async softDelete(id: string): Promise<void> {
    const coach = await this.prisma.coach.findFirst({ where: { id, deletedAt: null } });
    if (!coach) {
      throw new NotFoundException('Coach not found');
    }
    await this.prisma.coach.update({ where: { id }, data: { deletedAt: new Date() } });
  }
}
