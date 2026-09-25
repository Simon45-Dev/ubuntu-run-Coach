import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
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
import { ClubMembersModule } from './modules/club-members/club-members.module';
import { GroupsModule } from './modules/groups/groups.module';
import { TemplatesModule } from './modules/templates/templates.module';
import { RaceGoalsModule } from './modules/race-goals/race-goals.module';
import { PersonalBestsModule } from './modules/personal-bests/personal-bests.module';
import { CoachNotesModule } from './modules/coach-notes/coach-notes.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { ActionCentreModule } from './modules/action-centre/action-centre.module';
import { TrainingPlansModule } from './modules/training-plans/training-plans.module';
import { WorkoutsModule } from './modules/workouts/workouts.module';
import { MessagesModule } from './modules/messages/messages.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { ConsentsModule } from './modules/consents/consents.module';
import { CheckInsModule } from './modules/check-ins/check-ins.module';
import { AuditLogModule } from './modules/audit-log/audit-log.module';
import { PlatformStatsModule } from './modules/platform-stats/platform-stats.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [configuration], validate: validateEnv }),
    ScheduleModule.forRoot(),
    PrismaModule,
    AuditLogModule,
    HealthModule,
    AuthModule,
    UsersModule,
    OrganisationsModule,
    PlatformStatsModule,
    CoachesModule,
    AthletesModule,
    ClubMembersModule,
    GroupsModule,
    TemplatesModule,
    RaceGoalsModule,
    PersonalBestsModule,
    CoachNotesModule,
    AnalyticsModule,
    ActionCentreModule,
    TrainingPlansModule,
    WorkoutsModule,
    MessagesModule,
    NotificationsModule,
    ConsentsModule,
    CheckInsModule,
  ],
  providers: [{ provide: APP_INTERCEPTOR, useClass: AuditLogInterceptor }],
})
export class AppModule {}
