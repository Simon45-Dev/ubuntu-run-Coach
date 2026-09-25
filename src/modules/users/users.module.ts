import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { AvatarsController } from './avatars.controller';
import { StorageModule } from '../../common/storage/storage.module';

@Module({
  imports: [StorageModule],
  controllers: [UsersController, AvatarsController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
