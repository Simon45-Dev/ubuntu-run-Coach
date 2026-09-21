import { SetMetadata } from '@nestjs/common';

export const AUDIT_ACTION_KEY = 'auditAction';

/**
 * Marks a route as a sensitive action requiring an audit trail. Picked up by
 * AuditLogInterceptor, which writes one AuditLog row per successful request.
 */
export const Audit = (action: string) => SetMetadata(AUDIT_ACTION_KEY, action);
