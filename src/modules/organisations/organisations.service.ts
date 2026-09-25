import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AuthContext } from '../../common/auth-context';
import { Role } from '../../common/enums/role.enum';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { AvatarStorageService } from '../../common/storage/avatar-storage.service';
import { CreateOrganisationDto } from './dto/create-organisation.dto';
import { UpdateOrganisationDto } from './dto/update-organisation.dto';

/**
 * Wider than update()'s name/type check - a CLUB_ADMIN may not rename their
 * club or change its type, but branding isn't "coaching data" the way org
 * settings are, so they're allowed to manage the logo alongside COACH
 * (own org) and PLATFORM_ADMIN (any org).
 */
function assertCanManageLogo(ctx: AuthContext, id: string): void {
  if (ctx.role === Role.PLATFORM_ADMIN) return;
  if ((ctx.role === Role.COACH || ctx.role === Role.CLUB_ADMIN) && ctx.organisationId === id) {
    return;
  }
  throw new ForbiddenException();
}

@Injectable()
export class OrganisationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly avatarStorage: AvatarStorageService,
  ) {}

  /**
   * PLATFORM_ADMIN only (route already restricted by @Roles). No
   * Subscription row is created here - matching AuthService.register's
   * existing behaviour, not prisma/seed.ts's extra step. Nothing in the app
   * reads or enforces Subscription yet, so creating one here would be
   * speculative.
   */
  async create(dto: CreateOrganisationDto) {
    return this.prisma.organisation.create({ data: { name: dto.name, type: dto.type } });
  }

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
    return this.prisma.organisation.update({
      where: { id },
      data: { name: dto.name, type: dto.type },
    });
  }

  async uploadLogo(ctx: AuthContext, id: string, buffer: Buffer, mimeType: string) {
    assertCanManageLogo(ctx, id);
    const org = await this.prisma.organisation.findFirst({
      where: { id, deletedAt: null },
      select: { logoUrl: true },
    });
    if (!org) {
      throw new NotFoundException('Organisation not found');
    }
    await this.avatarStorage.delete(org.logoUrl);
    const logoUrl = await this.avatarStorage.save(buffer, mimeType);
    return this.prisma.organisation.update({ where: { id }, data: { logoUrl } });
  }

  async deleteLogo(ctx: AuthContext, id: string) {
    assertCanManageLogo(ctx, id);
    const org = await this.prisma.organisation.findFirst({
      where: { id, deletedAt: null },
      select: { logoUrl: true },
    });
    if (!org) {
      throw new NotFoundException('Organisation not found');
    }
    await this.avatarStorage.delete(org.logoUrl);
    return this.prisma.organisation.update({ where: { id }, data: { logoUrl: null } });
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
