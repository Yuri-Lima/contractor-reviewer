import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PurgeService } from './purge.service';

@Injectable()
export class PurgeScheduler {
  private readonly logger = new Logger(PurgeScheduler.name);

  constructor(private purgeService: PurgeService) {}

  /**
   * Run purge job daily at 2 AM
   */
  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async handlePurgeJob() {
    this.logger.log('Starting scheduled purge job...');
    try {
      const result = await this.purgeService.runFullPurge();
      this.logger.log(
        `Scheduled purge completed: ${result.files.deleted} files, ${result.textEmbeddings.deleted} chunks deleted`,
      );
    } catch (error) {
      this.logger.error('Scheduled purge job failed:', error);
    }
  }
}
