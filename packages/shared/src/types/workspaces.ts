import { WorkspaceRole } from '../enums/workspace.enum';
import { RetentionConfig } from './common';
import type { TranscriptionProviderId } from './transcription';
import type { TtsProviderId, TtsProviderConfig, ChatResponseMode } from './tts';
import type { LlmProviderId } from './llm';

export interface WorkspaceSettingsConfig {
  retention: RetentionConfig;
  general?: Record<string, unknown>;
  documentProcessing: {
    chunkingStrategy: string;
    defaultDocumentParser?: string;
    parserApiKeys?: Record<string, boolean>;
    /** Default LLM provider for chat/redline (openai | anthropic) */
    defaultLlmProvider?: LlmProviderId;
  };
  /** Transcription provider API keys (masked: configured/not) */
  transcriptionProviderApiKeys?: Record<TranscriptionProviderId, boolean>;
  /** Preferred transcription provider for this workspace (huggingface | openai) */
  preferredTranscriptionProvider?: TranscriptionProviderId | null;
  /** TTS provider API keys (masked: configured/not) */
  ttsProviderApiKeys?: Record<TtsProviderId, boolean>;
  /** Preferred TTS provider for this workspace */
  preferredTtsProvider?: TtsProviderId | null;
  /** Per-provider config (plan, output format, etc.). Keys are TtsProviderId. */
  ttsProviderConfig?: Partial<Record<TtsProviderId, TtsProviderConfig>>;
  /** Chat response mode: text only, audio only, or both */
  chatResponseMode?: ChatResponseMode;
  /** Auto-send message after voice recording completes */
  voiceAutoSend?: boolean;
  /** Include global prompts when building combined prompt (additive model) */
  promptScopeIncludeGlobal?: boolean;
  /** Include workspace prompts when building combined prompt (additive model) */
  promptScopeIncludeWorkspace?: boolean;
}

/**
 * Response from GET workspace settings. Includes currentUserRole so the frontend
 * can show/hide API key edit UI for non-admin roles.
 */
export interface WorkspaceSettingsGetResponse extends WorkspaceSettingsConfig {
  currentUserRole: WorkspaceRole;
}

/**
 * Request body for PATCH-style workspace settings updates.
 * All fields are optional; only provided fields are updated.
 * parserApiKeys: when writing, use string (raw API key) to set/update, false to remove.
 * API never returns raw keys; response uses Record<string, boolean> (configured/not).
 */
export interface UpdateWorkspaceSettingsRequest {
  retention?: Partial<RetentionConfig>;
  general?: Record<string, unknown>;
  documentProcessing?: {
    chunkingStrategy?: string;
    defaultDocumentParser?: string;
    parserApiKeys?: Record<string, string | boolean>;
    defaultLlmProvider?: LlmProviderId;
  };
  /** Transcription keys: provider id -> string (set) | false (remove) */
  transcriptionProviderApiKeys?: Record<TranscriptionProviderId, string | boolean>;
  /** Preferred transcription provider (huggingface | openai) */
  preferredTranscriptionProvider?: TranscriptionProviderId | null;
  /** TTS keys: provider id -> string (set) | false (remove) */
  ttsProviderApiKeys?: Record<TtsProviderId, string | boolean>;
  /** Preferred TTS provider */
  preferredTtsProvider?: TtsProviderId | null;
  /** Per-provider config (plan, output format, etc.). Keys are TtsProviderId. */
  ttsProviderConfig?: Partial<Record<TtsProviderId, TtsProviderConfig>>;
  /** Chat response mode */
  chatResponseMode?: ChatResponseMode;
  /** Voice recording auto-send */
  voiceAutoSend?: boolean;
  /** Include global prompts when building combined prompt */
  promptScopeIncludeGlobal?: boolean;
  /** Include workspace prompts when building combined prompt */
  promptScopeIncludeWorkspace?: boolean;
}

export interface Workspace {
  id: string;
  name: string;
  createdAt: string;
  updatedAt?: string;
}

export interface WorkspaceMember {
  id: string;
  workspaceId: string;
  userId: string;
  role: WorkspaceRole;
  joinedAt: string;
  user?: {
    id: string;
    name: string;
    email: string;
  };
}

export interface CreateWorkspaceRequest {
  name: string;
}

export interface UpdateWorkspaceRequest {
  name: string;
}

export interface AddMemberRequest {
  userId: string;
  role: WorkspaceRole;
}

export interface InviteMemberRequest {
  email: string;
  name?: string;
  password?: string;
  role: WorkspaceRole;
}
