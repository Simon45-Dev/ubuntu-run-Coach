import { Module } from '@nestjs/common';
import { CoachNotesController } from './coach-notes.controller';
import { CoachNotesService } from './coach-notes.service';

@Module({
  controllers: [CoachNotesController],
  providers: [CoachNotesService],
  exports: [CoachNotesService],
})
export class CoachNotesModule {}
