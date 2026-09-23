import { Module } from '@nestjs/common';
import { RaceGoalsController } from './race-goals.controller';
import { RaceGoalsService } from './race-goals.service';

@Module({
  controllers: [RaceGoalsController],
  providers: [RaceGoalsService],
  exports: [RaceGoalsService],
})
export class RaceGoalsModule {}
