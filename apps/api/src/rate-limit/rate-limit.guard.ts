import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';

export interface RateLimitOptions {
  requestsPerMinute?: number;
  requestsPerHour?: number;
  requestsPerDay?: number;
  tokensPerDay?: number; // For OpenAI API token budgets
}

// Simple in-memory rate limiter (for MVP)
// In production, use Redis-based rate limiting
interface RateLimitStore {
  [key: string]: {
    requests: number[];
    tokens: number;
    resetAt: number;
  };
}

@Injectable()
export class RateLimitGuard implements CanActivate {
  private store: RateLimitStore = {};
  private readonly defaultLimits: RateLimitOptions;

  constructor(
    private reflector: Reflector,
    private configService: ConfigService,
  ) {
    this.defaultLimits = {
      requestsPerMinute: parseInt(this.configService.get<string>('RATE_LIMIT_REQUESTS_PER_MINUTE') || '60'),
      requestsPerHour: parseInt(this.configService.get<string>('RATE_LIMIT_REQUESTS_PER_HOUR') || '1000'),
      requestsPerDay: parseInt(this.configService.get<string>('RATE_LIMIT_REQUESTS_PER_DAY') || '10000'),
      tokensPerDay: parseInt(this.configService.get<string>('RATE_LIMIT_TOKENS_PER_DAY') || '100000'),
    };
  }

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const handler = context.getHandler();
    
    // Get rate limit options from metadata or use defaults
    const options = this.reflector.get<RateLimitOptions>('rateLimit', handler) || this.defaultLimits;

    // Get user/workspace identifier
    const userId = request.user?.id || request.ip;
    const workspaceId = request.params?.workspaceId;
    const key = workspaceId ? `workspace:${workspaceId}` : `user:${userId}`;

    // Clean old entries
    this.cleanup();

    // Check rate limits
    if (!this.store[key]) {
      this.store[key] = {
        requests: [],
        tokens: 0,
        resetAt: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
      };
    }

    const limit = this.store[key];
    const now = Date.now();

    // Check per-minute limit
    if (options.requestsPerMinute) {
      const recentRequests = limit.requests.filter(
        (timestamp) => now - timestamp < 60 * 1000,
      );
      if (recentRequests.length >= options.requestsPerMinute) {
        throw new HttpException(
          {
            statusCode: HttpStatus.TOO_MANY_REQUESTS,
            message: 'Rate limit exceeded: too many requests per minute',
            retryAfter: 60,
          },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
    }

    // Check per-hour limit
    if (options.requestsPerHour) {
      const recentRequests = limit.requests.filter(
        (timestamp) => now - timestamp < 60 * 60 * 1000,
      );
      if (recentRequests.length >= options.requestsPerHour) {
        throw new HttpException(
          {
            statusCode: HttpStatus.TOO_MANY_REQUESTS,
            message: 'Rate limit exceeded: too many requests per hour',
            retryAfter: 3600,
          },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
    }

    // Check per-day limit
    if (options.requestsPerDay) {
      const recentRequests = limit.requests.filter(
        (timestamp) => now - timestamp < 24 * 60 * 60 * 1000,
      );
      if (recentRequests.length >= options.requestsPerDay) {
        throw new HttpException(
          {
            statusCode: HttpStatus.TOO_MANY_REQUESTS,
            message: 'Rate limit exceeded: too many requests per day',
            retryAfter: 86400,
          },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
    }

    // Check token budget (for OpenAI API calls)
    if (options.tokensPerDay && limit.tokens >= options.tokensPerDay) {
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: 'Token budget exceeded: daily token limit reached',
          retryAfter: 86400,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // Record request
    limit.requests.push(now);

    return true;
  }

  /**
   * Record token usage (call this after successful API requests)
   */
  recordTokens(key: string, tokens: number): void {
    if (!this.store[key]) {
      this.store[key] = {
        requests: [],
        tokens: 0,
        resetAt: Date.now() + 24 * 60 * 60 * 1000,
      };
    }
    this.store[key].tokens += tokens;
  }

  /**
   * Clean up old entries
   */
  private cleanup(): void {
    const now = Date.now();
    Object.keys(this.store).forEach((key) => {
      const limit = this.store[key];
      if (now > limit.resetAt) {
        delete this.store[key];
      } else {
        // Remove requests older than 24 hours
        limit.requests = limit.requests.filter(
          (timestamp) => now - timestamp < 24 * 60 * 60 * 1000,
        );
      }
    });
  }
}
