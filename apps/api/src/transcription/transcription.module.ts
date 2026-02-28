import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { FileTypeModule } from '../file-type/file-type.module';
import { TranscriptionProviderRegistry } from './transcription-provider.registry';
import { TranscriptionService } from './transcription.service';
import { AudioValidationService } from './audio-validation.service';

@Module({
  imports: [ConfigModule, FileTypeModule],
  providers: [TranscriptionProviderRegistry, TranscriptionService, AudioValidationService],
  exports: [TranscriptionService, AudioValidationService],
})
export class TranscriptionModule {}
