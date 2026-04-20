import { Injectable, Logger } from '@nestjs/common';
import type { ILlmProvider } from './interfaces/llm-provider.interface';
import { LLM_PROVIDER_ID, type LlmProviderId } from '@contractai-review/shared';
import { OpenAILlmAdapter } from './adapters/openai-llm.adapter';
import { AnthropicLlmAdapter } from './adapters/anthropic-llm.adapter';
import { XaiLlmAdapter } from './adapters/xai-llm.adapter';
import { WorkspaceSettingsService } from '../workspace/workspace-settings.service';

@Injectable()
export class LlmProviderRegistry {
  private readonly logger = new Logger(LlmProviderRegistry.name);
  private readonly providers = new Map<string, ILlmProvider>();

  constructor(
    private openaiAdapter: OpenAILlmAdapter,
    private anthropicAdapter: AnthropicLlmAdapter,
    private xaiAdapter: XaiLlmAdapter,
    private workspaceSettingsService: WorkspaceSettingsService,
  ) {
    this.providers.set(LLM_PROVIDER_ID.OpenAI, this.openaiAdapter);
    this.providers.set(LLM_PROVIDER_ID.Anthropic, this.anthropicAdapter);
    this.providers.set(LLM_PROVIDER_ID.XAI, this.xaiAdapter);
  }

  get(providerId: string): ILlmProvider | undefined {
    return this.providers.get(providerId);
  }

  getDefaultProviderId(): LlmProviderId {
    return LLM_PROVIDER_ID.OpenAI;
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

  /**
   * Resolve the LLM provider from already-fetched workspace settings,
   * avoiding a redundant DB round-trip when the caller already has them.
   */
  resolveFromSettings(settings?: { documentProcessing?: { defaultLlmProvider?: string } } | null): ILlmProvider {
    const providerId = settings?.documentProcessing?.defaultLlmProvider;
    const id = providerId || this.getDefaultProviderId();
    const provider = this.get(id);

    if (!provider) {
      this.logger.log(`[resolveFromSettings] Using fallback: providerId=OpenAI`);
      return this.openaiAdapter;
    }

    this.logger.log(`[resolveFromSettings] Resolved providerId=${id}`);
    return provider;
  }

  getAvailableIds(): string[] {
    return Array.from(this.providers.keys());
  }
}
