import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AuthContext } from '../../common/auth-context';
import { Role } from '../../common/enums/role.enum';
import { buildAthleteScopeFilter } from '../../common/scope/scope-filters';
import { CreateCoachNoteDto } from './dto/create-coach-note.dto';
import { UpdateCoachNoteDto } from './dto/update-coach-note.dto';

/**
 * Private to the authoring coach, never athlete-facing (every route is
 * @Roles(COACH, PLATFORM_ADMIN) - ATHLETE never reaches this service).
 * List/create are roster-scoped (any coach who currently has this athlete);
 * update/delete are scoped to whoever actually wrote the note, which may
 * differ from the athlete's current coach if they've since been reassigned.
 */
@Injectable()
export class CoachNotesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(ctx: AuthContext, athleteId: string, dto: CreateCoachNoteDto) {
    const athlete = await this.prisma.athlete.findFirst({
      where: { id: athleteId, deletedAt: null, ...buildAthleteScopeFilter(ctx) },
    });
    if (!athlete) {
      throw new NotFoundException('Athlete not found');
    }
    // PLATFORM_ADMIN authors as the athlete's current coach - a note with no
    // coach author would be meaningless, and an unassigned athlete has no
    // coach for it to belong to.
    const authorCoachId = ctx.role === Role.PLATFORM_ADMIN ? athlete.coachId : ctx.coachId;
    if (!authorCoachId) {
      throw new NotFoundException('Athlete has no assigned coach');
    }
    return this.prisma.coachNote.create({
      data: { athleteId, coachId: authorCoachId, content: dto.content },
    });
  }

  async findAllForAthlete(ctx: AuthContext, athleteId: string) {
    const athlete = await this.prisma.athlete.findFirst({
      where: { id: athleteId, deletedAt: null, ...buildAthleteScopeFilter(ctx) },
    });
    if (!athlete) {
      throw new NotFoundException('Athlete not found');
    }
    return this.prisma.coachNote.findMany({
      where: { athleteId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });
  }

  /** Author-scoped, not roster-scoped - see class doc comment. */
  private async findAuthoredOrThrow(ctx: AuthContext, id: string) {
    const note = await this.prisma.coachNote.findFirst({ where: { id, deletedAt: null } });
    if (!note) {
      throw new NotFoundException('Note not found');
    }
    if (ctx.role === Role.PLATFORM_ADMIN) {
      return note;
    }
    if (note.coachId !== ctx.coachId) {
      throw new NotFoundException('Note not found');
    }
    return note;
  }

  async update(ctx: AuthContext, id: string, dto: UpdateCoachNoteDto) {
    const note = await this.findAuthoredOrThrow(ctx, id);
    return this.prisma.coachNote.update({
      where: { id: note.id },
      data: { content: dto.content },
    });
  }

  async softDelete(ctx: AuthContext, id: string): Promise<void> {
    const note = await this.findAuthoredOrThrow(ctx, id);
    await this.prisma.coachNote.update({
      where: { id: note.id },
      data: { deletedAt: new Date() },
    });
  }
}
