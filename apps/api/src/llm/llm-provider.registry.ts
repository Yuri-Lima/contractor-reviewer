import { Injectable, Logger } from '@nestjs/common';
import type { ILlmProvider } from './interfaces/llm-provider.interface';
import { LlmProviderId } from '@contractai-review/shared';
import { OpenAILlmAdapter } from './adapters/openai-llm.adapter';
import { AnthropicLlmAdapter } from './adapters/anthropic-llm.adapter';
import { WorkspaceSettingsService } from '../workspace/workspace-settings.service';

@Injectable()
export class LlmProviderRegistry {
  private readonly logger = new Logger(LlmProviderRegistry.name);
  private readonly providers = new Map<string, ILlmProvider>();

  constructor(
    private openaiAdapter: OpenAILlmAdapter,
    private anthropicAdapter: AnthropicLlmAdapter,
    private workspaceSettingsService: WorkspaceSettingsService,
  ) {
    this.providers.set(LlmProviderId.OpenAI, this.openaiAdapter);
    this.providers.set(LlmProviderId.Anthropic, this.anthropicAdapter);
  }

  get(providerId: string): ILlmProvider | undefined {
    return this.providers.get(providerId);
  }

  getDefaultProviderId(): LlmProviderId {
    return LlmProviderId.OpenAI;
  }

  /**
   * Resolve the LLM provider for a workspace.
   * Uses workspace settings (defaultLlmProvider) or env default.
   */
  async resolveProvider(workspaceId?: string): Promise<ILlmProvider> {
    this.logger.log(
      `[resolveProvider] Resolve LLM provider via workspace settings: workspaceId=${workspaceId ?? 'none'}`,
    );
    let providerId: string | undefined;

    if (workspaceId) {
      const settings = await this.workspaceSettingsService.getSettings(
        workspaceId,
      );
      providerId = settings?.documentProcessing?.defaultLlmProvider;
    }

    const id = providerId || this.getDefaultProviderId();
    const provider = this.get(id);

    if (!provider) {
      this.logger.log(`[resolveProvider] Using fallback: providerId=OpenAI`);
      return this.openaiAdapter;
    }

    this.logger.log(`[resolveProvider] Resolved providerId=${id}`);
    return provider;
  }

  getAvailableIds(): string[] {
    return Array.from(this.providers.keys());
  }
}
