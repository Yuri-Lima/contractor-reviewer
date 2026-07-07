import {
  isEmbeddingModelCompatible,
  needsReembed,
  KNOWN_1536_DIM_MODELS,
} from './embedding-model.util';

describe('embedding-model compatibility (RAG drift)', () => {
  const active = 'text-embedding-3-small';

  it('documents the bug: same-dim models are not interchangeable', () => {
    expect(KNOWN_1536_DIM_MODELS).toContain('text-embedding-3-small');
    expect(KNOWN_1536_DIM_MODELS).toContain('text-embedding-ada-002');
    // Vectors from both are 1536-d but must NOT be treated as compatible
    expect(
      isEmbeddingModelCompatible('text-embedding-ada-002', active),
    ).toBe(false);
  });

  it('accepts an exact model match', () => {
    expect(isEmbeddingModelCompatible(active, active)).toBe(true);
  });

  it('rejects null/empty stored model (legacy unlabelled rows)', () => {
    expect(isEmbeddingModelCompatible(null, active)).toBe(false);
    expect(isEmbeddingModelCompatible('', active)).toBe(false);
    expect(isEmbeddingModelCompatible(undefined, active)).toBe(false);
  });

  it('needsReembed when vector missing', () => {
    expect(needsReembed(false, active, active)).toBe(true);
  });

  it('needsReembed when model drifted even if vector present', () => {
    expect(needsReembed(true, 'text-embedding-ada-002', active)).toBe(true);
  });

  it('does not re-embed when model matches and vector present', () => {
    expect(needsReembed(true, active, active)).toBe(false);
  });
});
