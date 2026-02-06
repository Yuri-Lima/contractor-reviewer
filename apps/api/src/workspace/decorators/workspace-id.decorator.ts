import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * Extract workspaceId from route parameters
 * Usage: @WorkspaceId() workspaceId: string
 */
export const WorkspaceId = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest();
    return request.params.workspaceId || request.params.id;
  },
);
