import { Module } from '@nestjs/common';
import { ActionCentreController } from './action-centre.controller';
import { ActionCentreService } from './action-centre.service';

@Module({
  controllers: [ActionCentreController],
  providers: [ActionCentreService],
  exports: [ActionCentreService],
})
export class ActionCentreModule {}
