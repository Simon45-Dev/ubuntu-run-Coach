import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, tap } from 'rxjs';
import { AUDIT_ACTION_KEY } from '../decorators/audit.decorator';
import { AuditLogService } from '../../modules/audit-log/audit-log.service';
import { AuthContext } from '../auth-context';

/**
 * Writes one AuditLog row per successful request on any route carrying
 * @Audit('ACTION_NAME'). Runs after the handler succeeds (via tap), so a
 * failed request (thrown exception) never produces a misleading audit entry.
 */
@Injectable()
export class AuditLogInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly auditLogService: AuditLogService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const action = this.reflector.getAllAndOverride<string | undefined>(AUDIT_ACTION_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!action) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest();
    const authContext: AuthContext | undefined = request.authContext;
    const targetEntityId: string =
      request.params?.id ?? request.params?.athleteId ?? request.params?.coachId ?? 'unknown';
    const targetEntityType = request.route?.path ?? context.getClass().name;

    return next.handle().pipe(
      tap(() => {
        void this.auditLogService.record({
          actorUserId: authContext?.userId ?? null,
          action,
          targetEntityType,
          targetEntityId,
          ipAddress: request.ip ?? null,
          userAgent: request.headers?.['user-agent'] ?? null,
        });
      }),
    );
  }
}
