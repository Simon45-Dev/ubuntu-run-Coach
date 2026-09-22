import { Module } from '@nestjs/common';
import { WorkoutsController } from './workouts.controller';
import { WorkoutsService } from './workouts.service';
import { WorkoutResultsController } from './workout-results.controller';
import { WorkoutResultsService } from './workout-results.service';

@Module({
  controllers: [WorkoutsController, WorkoutResultsController],
  providers: [WorkoutsService, WorkoutResultsService],
  exports: [WorkoutsService],
})
export class WorkoutsModule {}
