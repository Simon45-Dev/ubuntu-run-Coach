import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AuthContext } from '../../common/auth-context';
import { Role } from '../../common/enums/role.enum';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { UpdateOrganisationDto } from './dto/update-organisation.dto';

@Injectable()
export class OrganisationsService {
  constructor(private readonly prisma: PrismaService) {}

  // Note: buildOrgScopeFilter (src/common/scope/scope-filters.ts) scopes
  // models that carry an organisationId FK (Coach, Subscription). The
  // Organisation row itself is scoped by comparing its own id, so that
  // helper doesn't apply here - the comparison is done directly.
  //
  // In practice OrgScopeGuard (applied via @ScopeResource('organisation') on
  // the controller route) already rejects a mismatched :id with 403 before
  // this runs, since a caller's own organisationId is a fixed JWT claim, not
  // something that needs a DB lookup to check. This service-layer check is
  // defence-in-depth for any future route that reaches this method without
  // that guard.
  async findOne(ctx: AuthContext, id: string) {
    if (ctx.role !== Role.PLATFORM_ADMIN && ctx.organisationId !== id) {
      throw new NotFoundException('Organisation not found');
    }
    const org = await this.prisma.organisation.findFirst({ where: { id, deletedAt: null } });
    if (!org) {
      throw new NotFoundException('Organisation not found');
    }
    return org;
  }

  async update(ctx: AuthContext, id: string, dto: UpdateOrganisationDto) {
    if (ctx.role !== Role.PLATFORM_ADMIN) {
      if (ctx.role !== Role.COACH || ctx.organisationId !== id) {
        throw new ForbiddenException();
      }
    }
    const org = await this.prisma.organisation.findFirst({ where: { id, deletedAt: null } });
    if (!org) {
      throw new NotFoundException('Organisation not found');
    }
    return this.prisma.organisation.update({ where: { id }, data: { name: dto.name } });
  }

  /** PLATFORM_ADMIN only - route already restricted by @Roles. */
  async findAll(pagination: PaginationQueryDto) {
    const { page, pageSize } = pagination;
    const [items, total] = await Promise.all([
      this.prisma.organisation.findMany({
        where: { deletedAt: null },
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.organisation.count({ where: { deletedAt: null } }),
    ]);
    return { items, total, page, pageSize };
  }
}
