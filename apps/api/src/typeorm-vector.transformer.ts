import { ValueTransformer } from 'typeorm';

/**
 * Transformer for pgvector type
 * Converts between PostgreSQL vector format and JavaScript number array
 */
export const vectorTransformer: ValueTransformer = {
  to: (value: number[] | null): string | null => {
    if (!value || !Array.isArray(value)) {
      return null;
    }
    // Convert array to PostgreSQL vector format: '[0.1,0.2,0.3]'
    return `[${value.join(',')}]`;
  },
  from: (value: string | null): number[] | null => {
    if (!value) {
      return null;
    }
    // Parse PostgreSQL vector format: '[0.1,0.2,0.3]' -> [0.1, 0.2, 0.3]
    if (typeof value === 'string' && value.startsWith('[') && value.endsWith(']')) {
      return value
        .slice(1, -1)
        .split(',')
        .map((v) => parseFloat(v.trim()));
    }
    // If already an array (from some drivers), return as-is
    if (Array.isArray(value)) {
      return value;
    }
    return null;
  },
};
