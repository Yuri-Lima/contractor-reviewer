import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { OpenAILlmAdapter } from './adapters/openai-llm.adapter';
import { AnthropicLlmAdapter } from './adapters/anthropic-llm.adapter';
import { LlmProviderRegistry } from './llm-provider.registry';
import { WorkspaceModule } from '../workspace/workspace.module';

@Module({
  imports: [ConfigModule, WorkspaceModule],
  providers: [OpenAILlmAdapter, AnthropicLlmAdapter, LlmProviderRegistry],
  exports: [LlmProviderRegistry],
})
export class LlmModule {}
