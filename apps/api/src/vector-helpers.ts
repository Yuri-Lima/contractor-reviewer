/**
 * Helper functions for working with pgvector columns
 * 
 * Note: TypeORM doesn't natively support the 'vector' type from pgvector.
 * The entities use 'text' type with a transformer, but for vector operations
 * (similarity search, etc.), you should use raw SQL queries.
 * 
 * Example similarity search:
 * ```typescript
 * const results = await repository.query(`
 *   SELECT *, embedding <-> $1::vector AS distance
 *   FROM chunks
 *   WHERE document_id = $2
 *   ORDER BY distance
 *   LIMIT $3
 * `, [embeddingArray, documentId, limit]);
 * ```
 */

/**
 * Convert a number array to PostgreSQL vector format string
 */
export function arrayToVectorString(arr: number[]): string {
  return `[${arr.join(',')}]`;
}
