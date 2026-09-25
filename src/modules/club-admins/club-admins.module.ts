import { Module } from '@nestjs/common';
import { ClubAdminsController } from './club-admins.controller';
import { ClubAdminsService } from './club-admins.service';
import { EmailModule } from '../email/email.module';

@Module({
  imports: [EmailModule],
  controllers: [ClubAdminsController],
  providers: [ClubAdminsService],
})
export class ClubAdminsModule {}
