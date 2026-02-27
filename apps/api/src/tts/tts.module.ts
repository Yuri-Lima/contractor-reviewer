import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TtsProviderRegistry } from './tts-provider.registry';
import { TtsService } from './tts.service';

@Module({
  imports: [ConfigModule],
  providers: [TtsProviderRegistry, TtsService],
  exports: [TtsService],
})
export class TtsModule {}
