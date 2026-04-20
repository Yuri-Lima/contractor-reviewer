/**
 * Narrow shape for citations from the user's contract or uploaded document.
 * Use with `satisfies DocumentCitation` when building RAG citations so `type` and fields stay aligned.
 */
export interface DocumentCitation {
  type: 'document' | 'contract';
  fileName?: string;
  pageNumber?: number;
  paragraph?: string;
  paragraphId?: string;
  quoteSnippet?: string;
  /** Numbered clause label (e.g. "9.1.3") when the chunk has hierarchical heading metadata. Phase 2 of legal-review pipeline. */
  clauseNumber?: string;
}

/**
 * Narrow shape for citations from legal/regulatory sources.
 * Use with `satisfies LegalSourceCitation` when building RAG citations.
 */
export interface LegalSourceCitation {
  type: 'legal';
  sourceName?: string;
  section?: string;
  url?: string;
  quoteSnippet?: string;
}

// Common citation interface (unified wire/API shape for document, legal and web citations)
export interface Citation {
  type: 'contract' | 'document' | 'legal' | 'web';
  fileName?: string;
  pageNumber?: number;
  paragraph?: string;
  paragraphId?: string;
  quoteSnippet?: string;
  sourceName?: string;
  section?: string;
  url?: string;
  /** Numbered clause label (e.g. "9.1.3") when the chunk has hierarchical heading metadata. Phase 2 of legal-review pipeline. */
  clauseNumber?: string;
  /** Web-only: page title returned by the search provider. */
  title?: string;
  /** Web-only: short summary returned by the search provider. */
  snippet?: string;
}

// User types
export interface User {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string | null;
  createdAt: string;
  /** RAG cache similarity threshold (0.8-1.0). null = use server default 0.95 */
  ragCacheSimilarityThreshold?: number | null;
  /** True if user is OWNER in at least one workspace. Only present in account response. */
  isOwnerInAnyWorkspace?: boolean;
}

/** Request body for PATCH /account/preferences */
export interface UpdateAccountPreferencesRequest {
  ragCacheSimilarityThreshold?: number | null;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  name: string;
}

export interface LoginResponse {
  user: User;
  accessToken: string;
}

// Retention configuration
export interface RetentionConfig {
  defaultFileRetentionDays: number;
  defaultTextEmbeddingsRetentionDays: number;
  retentionOverrides?: Record<string, number>;
  fuzzyMatchThreshold?: number; // Minimum match percentage for fuzzy matching (0-100)
}
