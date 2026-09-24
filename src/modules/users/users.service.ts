import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { AuthContext } from '../../common/auth-context';
import { Role } from '../../common/enums/role.enum';
import { UserStatus } from '../../common/enums/user-status.enum';
import { UpdateMeDto } from './dto/update-me.dto';
import { ListUsersQueryDto } from './dto/list-users-query.dto';
import { AvatarStorageService } from './avatar-storage.service';

const PUBLIC_USER_SELECT = {
  id: true,
  email: true,
  name: true,
  role: true,
  status: true,
  mfaEnabled: true,
  avatarUrl: true,
  createdAt: true,
} as const;

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly avatarStorage: AvatarStorageService,
  ) {}

  async findMe(ctx: AuthContext) {
    return this.prisma.user.findUniqueOrThrow({
      where: { id: ctx.userId },
      select: PUBLIC_USER_SELECT,
    });
  }

  async updateMe(ctx: AuthContext, dto: UpdateMeDto) {
    return this.prisma.user.update({
      where: { id: ctx.userId },
      data: { name: dto.name },
      select: PUBLIC_USER_SELECT,
    });
  }

  async uploadAvatar(ctx: AuthContext, buffer: Buffer, mimeType: string) {
    const existing = await this.prisma.user.findUniqueOrThrow({
      where: { id: ctx.userId },
      select: { avatarUrl: true },
    });
    await this.avatarStorage.delete(existing.avatarUrl);
    const avatarUrl = await this.avatarStorage.save(buffer, mimeType);
    return this.prisma.user.update({
      where: { id: ctx.userId },
      data: { avatarUrl },
      select: PUBLIC_USER_SELECT,
    });
  }

  async deleteAvatar(ctx: AuthContext) {
    const existing = await this.prisma.user.findUniqueOrThrow({
      where: { id: ctx.userId },
      select: { avatarUrl: true },
    });
    await this.avatarStorage.delete(existing.avatarUrl);
    return this.prisma.user.update({
      where: { id: ctx.userId },
      data: { avatarUrl: null },
      select: PUBLIC_USER_SELECT,
    });
  }

  /** PLATFORM_ADMIN only - route already restricted by @Roles. */
  async findAll(query: ListUsersQueryDto) {
    const { page, pageSize, search, role } = query;
    const where: Prisma.UserWhereInput = {
      deletedAt: null,
      ...(role ? { role } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { email: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        select: PUBLIC_USER_SELECT,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count({ where }),
    ]);
    return { items, total, page, pageSize };
  }

  /** Self, or PLATFORM_ADMIN. */
  async findOne(ctx: AuthContext, id: string) {
    if (ctx.role !== Role.PLATFORM_ADMIN && ctx.userId !== id) {
      throw new ForbiddenException();
    }
    const user = await this.prisma.user.findFirst({
      where: { id, deletedAt: null },
      select: PUBLIC_USER_SELECT,
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  async updateStatus(id: string, status: UserStatus) {
    const user = await this.prisma.user.findFirst({ where: { id, deletedAt: null } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return this.prisma.user.update({
      where: { id },
      data: { status },
      select: PUBLIC_USER_SELECT,
    });
  }

  async softDelete(id: string): Promise<void> {
    const user = await this.prisma.user.findFirst({ where: { id, deletedAt: null } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    await this.prisma.user.update({
      where: { id },
      data: { deletedAt: new Date(), status: UserStatus.DEACTIVATED },
    });
  }
}
