import { Module } from '@nestjs/common';
import { OrganisationsController } from './organisations.controller';
import { OrganisationsService } from './organisations.service';
import { StorageModule } from '../../common/storage/storage.module';

@Module({
  imports: [StorageModule],
  controllers: [OrganisationsController],
  providers: [OrganisationsService],
  exports: [OrganisationsService],
})
export class OrganisationsModule {}
