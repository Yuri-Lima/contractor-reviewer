import { SelectQueryBuilder, ObjectLiteral } from 'typeorm';

/**
 * Helper functions to ensure all queries filter by workspaceId
 * This enforces multi-tenant isolation at the query level
 */

/**
 * Add workspace filter to a query builder
 * Ensures all resources are scoped to a specific workspace
 */
export function addWorkspaceFilter<T extends ObjectLiteral>(
  qb: SelectQueryBuilder<T>,
  workspaceId: string,
  alias: string = qb.alias,
): SelectQueryBuilder<T> {
  return qb.andWhere(`${alias}.workspaceId = :workspaceId`, { workspaceId });
}

/**
 * Create a base query with workspace filter
 * Usage in repositories:
 * ```typescript
 * const qb = this.createQueryBuilder('document');
 * addWorkspaceFilter(qb, workspaceId);
 * return qb.getMany();
 * ```
 */
export function createWorkspaceScopedQuery<T extends ObjectLiteral>(
  repository: { createQueryBuilder: (alias: string) => SelectQueryBuilder<T> },
  alias: string,
  workspaceId: string,
): SelectQueryBuilder<T> {
  const qb = repository.createQueryBuilder(alias);
  return addWorkspaceFilter(qb, workspaceId, alias);
}
