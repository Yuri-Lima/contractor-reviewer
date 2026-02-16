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
  createdAt: string;
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
