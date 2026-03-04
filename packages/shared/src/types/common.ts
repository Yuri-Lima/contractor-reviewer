// Common citation interface (unified for both contract and legal citations)
export interface Citation {
  type: 'contract' | 'legal';
  fileName?: string;
  pageNumber?: number;
  paragraph?: string;
  paragraphId?: string;
  quoteSnippet?: string;
  sourceName?: string;
  section?: string;
  url?: string;
}

// Pagination types
export interface PaginationParams {
  limit?: number;
  offset?: number;
  page?: number;
  pageSize?: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  limit: number;
  offset: number;
  page?: number;
  pageSize?: number;
}

// API Response wrapper
export interface ApiResponse<T> {
  data: T;
  message?: string;
  error?: string;
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
