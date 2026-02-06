import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface RequestInfo {
  ip: string;
  userAgent: string;
}

/**
 * Extract IP address and User-Agent from request
 */
export const RequestInfo = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): RequestInfo => {
    const request = ctx.switchToHttp().getRequest();
    
    // Get IP address (considering proxies)
    const ip =
      request.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
      request.headers['x-real-ip'] ||
      request.connection?.remoteAddress ||
      request.socket?.remoteAddress ||
      request.ip ||
      'unknown';

    // Get User-Agent
    const userAgent = request.headers['user-agent'] || 'unknown';

    return { ip, userAgent };
  },
);
