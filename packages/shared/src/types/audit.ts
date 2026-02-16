import { AuditAction, TargetType } from '../enums/audit.enum';

export interface AuditLog {
  id: string;
  workspaceId: string;
  actorUserId: string;
  action: AuditAction;
  targetType: TargetType;
  targetId: string | null;
  ip: string | null;
  userAgent: string | null;
  metadata: Record<string, any> | null;
  createdAt: string;
}

export interface AuditLogQueryDto {
  action?: AuditAction;
  userId?: string;
  targetType?: TargetType;
  startDate?: string; // ISO date string
  endDate?: string; // ISO date string
  limit?: number;
  offset?: number;
}
