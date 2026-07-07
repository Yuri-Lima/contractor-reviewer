/**
 * Helpers for embedding-model identity tracking.
 * Prevents silent RAG recall degradation when vectors from different models
 * co-exist in the same table (same dimensionality, incompatible geometry).
 */

/** Models known to emit 1536-dim vectors — still NOT interchangeable. */
export const KNOWN_1536_DIM_MODELS = [
  'text-embedding-3-small',
  'text-embedding-ada-002',
] as const;

/**
 * Returns true when a stored embedding row is compatible with the active model.
 * Legacy rows with a null model are treated as incompatible once a model is set
 * (force re-embed) so mixed unlabelled data cannot poison recall.
 */
export function isEmbeddingModelCompatible(
  storedModel: string | null | undefined,
  activeModel: string,
): boolean {
  if (!activeModel) return false;
  if (storedModel == null || storedModel === '') return false;
  return storedModel === activeModel;
}

/**
 * Pure predicate used by workers: should this row be re-embedded?
 */
export function needsReembed(
  hasEmbedding: boolean,
  storedModel: string | null | undefined,
  activeModel: string,
): boolean {
  if (!hasEmbedding) return true;
  return !isEmbeddingModelCompatible(storedModel, activeModel);
}
