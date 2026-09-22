import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { MessagesService } from './messages.service';
import { SendMessageDto } from './dto/send-message.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { OrgScopeGuard } from '../../common/guards/org-scope.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthContext } from '../../common/auth-context';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

@ApiTags('messages')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, OrgScopeGuard)
@Controller()
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  @Post('users/:userId/messages')
  send(
    @CurrentUser() ctx: AuthContext,
    @Param('userId') userId: string,
    @Body() dto: SendMessageDto,
  ) {
    return this.messagesService.send(ctx, userId, dto);
  }

  @Get('users/:userId/messages')
  findThread(
    @CurrentUser() ctx: AuthContext,
    @Param('userId') userId: string,
    @Query() pagination: PaginationQueryDto,
  ) {
    return this.messagesService.findThread(ctx, userId, pagination);
  }

  @Patch('messages/:id/read')
  markRead(@CurrentUser() ctx: AuthContext, @Param('id') id: string) {
    return this.messagesService.markRead(ctx, id);
  }
}
