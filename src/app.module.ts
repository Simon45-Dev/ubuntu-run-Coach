import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_INTERCEPTOR } from '@nestjs/core';
import configuration from './config/configuration';
import { validateEnv } from './config/env.validation';
import { PrismaModule } from './database/prisma.module';
import { AuditLogInterceptor } from './common/interceptors/audit-log.interceptor';
import { HealthModule } from './modules/health/health.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { OrganisationsModule } from './modules/organisations/organisations.module';
import { CoachesModule } from './modules/coaches/coaches.module';
import { AthletesModule } from './modules/athletes/athletes.module';
import { GroupsModule } from './modules/groups/groups.module';
import { TrainingPlansModule } from './modules/training-plans/training-plans.module';
import { WorkoutsModule } from './modules/workouts/workouts.module';
import { MessagesModule } from './modules/messages/messages.module';
import { ConsentsModule } from './modules/consents/consents.module';
import { CheckInsModule } from './modules/check-ins/check-ins.module';
import { AuditLogModule } from './modules/audit-log/audit-log.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [configuration], validate: validateEnv }),
    PrismaModule,
    AuditLogModule,
    HealthModule,
    AuthModule,
    UsersModule,
    OrganisationsModule,
    CoachesModule,
    AthletesModule,
    GroupsModule,
    TrainingPlansModule,
    WorkoutsModule,
    MessagesModule,
    ConsentsModule,
    CheckInsModule,
  ],
  providers: [{ provide: APP_INTERCEPTOR, useClass: AuditLogInterceptor }],
})
export class AppModule {}
