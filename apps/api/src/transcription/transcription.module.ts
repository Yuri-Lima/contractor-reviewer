import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TranscriptionProviderRegistry } from './transcription-provider.registry';
import { TranscriptionService } from './transcription.service';

@Module({
  imports: [ConfigModule],
  providers: [TranscriptionProviderRegistry, TranscriptionService],
  exports: [TranscriptionService],
})
export class TranscriptionModule {}
