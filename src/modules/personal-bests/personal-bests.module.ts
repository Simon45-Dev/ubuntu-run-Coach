import { Module } from '@nestjs/common';
import { PersonalBestsController } from './personal-bests.controller';
import { PersonalBestsService } from './personal-bests.service';

@Module({
  controllers: [PersonalBestsController],
  providers: [PersonalBestsService],
  exports: [PersonalBestsService],
})
export class PersonalBestsModule {}
