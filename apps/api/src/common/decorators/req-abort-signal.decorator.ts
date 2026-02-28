import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request, Response } from 'express';

/**
 * Returns an AbortSignal tied to the HTTP request lifecycle.
 * When the client disconnects (req.socket closes), the signal aborts.
 * Use for request handlers that perform async work and should stop on client disconnect.
 */
export const ReqAbortSignal = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): AbortSignal => {
    const request = ctx.switchToHttp().getRequest<Request>();
    const response = ctx.switchToHttp().getResponse<Response>();
    const controller = new AbortController();

    const onClose = () => controller.abort();

    if (request.socket) {
      request.socket.once('close', onClose);
    }

    response.once('finish', () => {
      if (request.socket) {
        request.socket.off('close', onClose);
      }
    });

    return controller.signal;
  },
);
