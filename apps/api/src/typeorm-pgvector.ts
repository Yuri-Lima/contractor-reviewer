import { DataSource } from 'typeorm';

/**
 * Register pgvector custom column type with TypeORM
 * This allows us to use 'vector' as a column type in entities
 */
export function registerPgVectorType(dataSource: DataSource) {
  // TypeORM doesn't natively support vector, so we'll use real[] in entities
  // and handle vector operations via raw SQL queries
  // The migration creates the column as 'vector' type in PostgreSQL
}
