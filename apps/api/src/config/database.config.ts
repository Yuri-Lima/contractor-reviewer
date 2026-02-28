/**
 * Database connection configuration.
 * Supports optional VECTOR_DATABASE_URL for future separation of relational and vector DBs.
 * When VECTOR_DATABASE_URL is unset, both use DATABASE_URL (single DB).
 */
export interface DatabaseConfig {
  /** Connection URL for relational tables (documents, workspaces, users, etc.) */
  relationalConnectionUrl: string;
  /** Connection URL for vector tables (chunks, embeddings). Defaults to relational when not separated. */
  vectorConnectionUrl: string;
  /** True when using separate databases */
  isSeparated: boolean;
}

export function getDatabaseConfig(
  relationalUrl: string | undefined,
  vectorUrl: string | undefined,
): DatabaseConfig {
  const relational = relationalUrl || process.env.DATABASE_URL || '';
  const vector = vectorUrl || process.env.VECTOR_DATABASE_URL || relational;

  return {
    relationalConnectionUrl: relational,
    vectorConnectionUrl: vector,
    isSeparated: !!vectorUrl || !!process.env.VECTOR_DATABASE_URL,
  };
}
