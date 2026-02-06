import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * Extract current user from request (set by JwtAuthGuard)
 * Usage: @CurrentUser() user: { id: string; email: string; role: string }
 */
export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);
