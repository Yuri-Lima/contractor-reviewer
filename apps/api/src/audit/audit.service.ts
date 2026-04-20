import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog as AuditLogEntity, AuditAction, TargetType } from '../entities/audit-log.entity';
import { AuditLogQueryDto, AuditLog } from '@contractai-review/shared';

@Injectable()
export class AuditService {
  constructor(
    @InjectRepository(AuditLogEntity)
    private auditLogRepository: Repository<AuditLogEntity>,
  ) {}

  /**
   * Get audit logs with filters
   */
  async getAuditLogs(
    workspaceId: string,
    query: AuditLogQueryDto,
  ): Promise<{
    logs: AuditLog[];
    total: number;
    limit: number;
    offset: number;
  }> {
    const limit = Math.min(query.limit || 50, 100); // Max 100 per page
    const offset = query.offset || 0;

    const qb = this.auditLogRepository
      .createQueryBuilder('audit')
      .where('audit.workspaceId = :workspaceId', { workspaceId })
      .orderBy('audit.createdAt', 'DESC')
      .take(limit)
      .skip(offset);

    // Apply filters
    if (query.action) {
      qb.andWhere('audit.action = :action', { action: query.action });
    }

    if (query.userId) {
      qb.andWhere('audit.actorUserId = :userId', { userId: query.userId });
    }

    if (query.targetType) {
      qb.andWhere('audit.targetType = :targetType', { targetType: query.targetType });
    }

    if (query.startDate || query.endDate) {
      const startDate = query.startDate ? new Date(query.startDate) : undefined;
      const endDate = query.endDate ? new Date(query.endDate) : undefined;

      if (startDate && endDate) {
        qb.andWhere('audit.createdAt BETWEEN :startDate AND :endDate', {
          startDate,
          endDate,
        });
      } else if (startDate) {
        qb.andWhere('audit.createdAt >= :startDate', { startDate });
      } else if (endDate) {
        qb.andWhere('audit.createdAt <= :endDate', { endDate });
      }
    }

    const [logs, total] = await qb.getManyAndCount();

    // Map entities to shared interface (convert Date to string)
    const mappedLogs: AuditLog[] = logs.map((log) => ({
      id: log.id,
      workspaceId: log.workspaceId,
      actorUserId: log.actorUserId,
      action: log.action,
      targetType: log.targetType,
      targetId: log.targetId,
      ip: log.ip,
      userAgent: log.userAgent,
      metadata: log.metadata,
      createdAt: log.createdAt.toISOString(),
    }));

    return {
      logs: mappedLogs,
      total,
      limit,
      offset,
    };
  }

  /**
   * Create audit log entry
   */
  async createAuditLog(
    workspaceId: string,
    actorUserId: string,
    action: AuditAction,
    targetType: TargetType,
    targetId: string | null,
    ip?: string,
    userAgent?: string,
    metadata?: Record<string, any>,
  ): Promise<AuditLogEntity> {
    const auditLog = new AuditLogEntity();
    auditLog.workspaceId = workspaceId;
    auditLog.actorUserId = actorUserId;
    auditLog.action = action;
    auditLog.targetType = targetType;
    auditLog.targetId = targetId ?? null;
    auditLog.ip = ip ?? null;
    auditLog.userAgent = userAgent ?? null;
    auditLog.metadata = metadata ?? null;

    return await this.auditLogRepository.save(auditLog);
  }
}
