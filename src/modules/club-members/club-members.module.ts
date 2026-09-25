import { Module } from '@nestjs/common';
import { ClubMembersController } from './club-members.controller';
import { ClubMembersService } from './club-members.service';
import { EmailModule } from '../email/email.module';

@Module({
  imports: [EmailModule],
  controllers: [ClubMembersController],
  providers: [ClubMembersService],
})
export class ClubMembersModule {}
