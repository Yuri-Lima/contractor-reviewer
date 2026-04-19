import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import IORedis from 'ioredis';
import { REDIS_CLIENT } from '../queue/redis.provider';
import { WebSocketService } from './websocket.service';
import { ConfigService } from '@nestjs/config';
import {
  type DocumentJob,
  JOB_PROGRESS_EVENT,
  JOB_PROGRESS_CONSUMER_GROUP,
} from '@contractai-review/shared';
const CLAIM_IDLE_MS = 5 * 60 * 1000; // 5 minutes
const RECOVERY_INTERVAL_MS = 60 * 1000; // 1 minute

@Injectable()
export class JobProgressStreamConsumer implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(JobProgressStreamConsumer.name);
  private running = false;
  private consumerId: string;
  private recoveryTimer: ReturnType<typeof setInterval> | null = null;

  constructor(
    @Inject(REDIS_CLIENT)
    private readonly redis: IORedis,
    private readonly webSocketService: WebSocketService,
    private readonly configService: ConfigService,
  ) {
    this.consumerId = `api-${process.pid}`;
  }

  async onModuleInit(): Promise<void> {
    const enabled = this.configService.get<string>('WS_ENABLED');
    if (enabled === 'false') {
      this.logger.log('WebSocket disabled, stream consumer not started');
      return;
    }

    this.running = true;
    await this.ensureConsumerGroup();
    this.runLoop();
    this.startRecoveryLoop();
  }

  onModuleDestroy(): void {
    this.running = false;
    if (this.recoveryTimer) {
      clearInterval(this.recoveryTimer);
      this.recoveryTimer = null;
    }
  }

  private startRecoveryLoop(): void {
    this.recoveryTimer = setInterval(() => {
      void this.claimStuckMessages();
    }, RECOVERY_INTERVAL_MS);
  }

  /**
   * Claims messages idle longer than CLAIM_IDLE_MS from other consumers,
   * processes them, and ACKs. Prevents stuck messages when a consumer dies.
   */
  private async claimStuckMessages(): Promise<void> {
    if (!this.running) return;

    try {
      // XPENDING key group IDLE min-idle-time start end count
      const pending = await this.redis.call(
        'XPENDING',
        JOB_PROGRESS_EVENT,
        JOB_PROGRESS_CONSUMER_GROUP,
        'IDLE',
        CLAIM_IDLE_MS,
        '-',
        '+',
        100,
      );
      const entries = pending as Array<[string, string, number, number]> | null;
      if (!entries || entries.length === 0) return;

      const idsToClaim: string[] = [];
      for (const [id, consumer] of entries) {
        if (consumer !== this.consumerId) {
          idsToClaim.push(id);
        }
      }
      if (idsToClaim.length === 0) return;

      // XCLAIM key group consumer min-idle-time id [id ...]
      const claimed = await this.redis.xclaim(
        JOB_PROGRESS_EVENT,
        JOB_PROGRESS_CONSUMER_GROUP,
        this.consumerId,
        CLAIM_IDLE_MS,
        ...idsToClaim,
      );

      if (!claimed || claimed.length === 0) return;

      for (const item of claimed) {
        const [id, fields] = Array.isArray(item) ? item : [item, []];
        const fieldArray = Array.isArray(fields)
          ? fields
          : typeof fields === 'object' && fields !== null
            ? (Object.entries(fields) as [string, string][]).flat()
            : [];
        try {
          await this.processMessage(String(id), fieldArray);
          await this.redis.xack(JOB_PROGRESS_EVENT, JOB_PROGRESS_CONSUMER_GROUP, String(id));
        } catch (err) {
          this.logger.error(
            `Failed to process claimed message ${id}: ${err instanceof Error ? err.message : String(err)}`,
          );
          // ACK to prevent infinite retries for permanently bad messages
          await this.redis.xack(JOB_PROGRESS_EVENT, JOB_PROGRESS_CONSUMER_GROUP, String(id));
        }
      }

      this.logger.debug(`Claimed and processed ${claimed.length} stuck message(s)`);
    } catch (err) {
      if (this.running) {
        this.logger.warn(
          `Stuck message recovery error: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
  }

  private async ensureConsumerGroup(): Promise<void> {
    try {
      await this.redis.xgroup('CREATE', JOB_PROGRESS_EVENT, JOB_PROGRESS_CONSUMER_GROUP, '0', 'MKSTREAM');
      this.logger.log(`Created consumer group ${JOB_PROGRESS_CONSUMER_GROUP} for ${JOB_PROGRESS_EVENT}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('BUSYGROUP')) {
        this.logger.debug(`Consumer group ${JOB_PROGRESS_CONSUMER_GROUP} already exists`);
      } else {
        this.logger.error(`Failed to create consumer group: ${msg}`);
      }
    }
  }

  private async runLoop(): Promise<void> {
    while (this.running) {
      try {
        const result = await this.redis.xreadgroup(
          'GROUP',
          JOB_PROGRESS_CONSUMER_GROUP,
          this.consumerId,
          'BLOCK',
          5000,
          'STREAMS',
          JOB_PROGRESS_EVENT,
          '>',
        );

        if (!result || result.length === 0) continue;

        const entries = result as Array<[string, Array<[string, string[]]>]>;
        for (const [stream, messages] of entries) {
          if (stream !== JOB_PROGRESS_EVENT) continue;
          for (const [id, fields] of messages) {
            try {
              await this.processMessage(id, fields);
              await this.redis.xack(JOB_PROGRESS_EVENT, JOB_PROGRESS_CONSUMER_GROUP, id);
            } catch (err) {
              this.logger.error(
                `Failed to process message ${id}: ${err instanceof Error ? err.message : String(err)}`,
              );
              // Don't ACK - message will be retried or claimed
            }
          }
        }
      } catch (err) {
        if (this.running) {
          this.logger.error(
            `Stream read error: ${err instanceof Error ? err.message : String(err)}`,
          );
        }
        await new Promise((r) => setTimeout(r, 1000));
      }
    }
  }

  private async processMessage(
    _messageId: string,
    fields: string[],
  ): Promise<void> {
    const raw: Record<string, string> = {};
    for (let i = 0; i < fields.length; i += 2) {
      raw[fields[i]] = fields[i + 1];
    }

    const documentId = raw.documentId;
    const workspaceId = raw.workspaceId;
    const payloadStr = raw.payload;

    if (!documentId || !workspaceId || !payloadStr) {
      this.logger.warn('Invalid stream message: missing documentId, workspaceId or payload');
      return;
    }

    let job: DocumentJob;
    try {
      job = JSON.parse(payloadStr) as DocumentJob;
    } catch {
      this.logger.warn('Invalid stream message: payload is not valid JSON');
      return;
    }

    this.webSocketService.emitJobProgress(documentId, workspaceId, job);
  }
}
