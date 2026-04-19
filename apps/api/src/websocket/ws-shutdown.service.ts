import { Logger, OnApplicationShutdown } from '@nestjs/common';
import { WS_SHUTDOWN_REGISTRY } from './ws-shutdown.registry';

/**
 * Runs WebSocket server and Redis adapter shutdown on application termination.
 * The WsPortIoAdapter registers its cleanup callback in WS_SHUTDOWN_REGISTRY.
 */
export class WsShutdownService implements OnApplicationShutdown {
  private readonly logger = new Logger(WsShutdownService.name);

  async onApplicationShutdown(): Promise<void> {
    try {
      await WS_SHUTDOWN_REGISTRY.run();
      this.logger.log('WebSocket server and Redis adapter closed');
    } catch (err) {
      this.logger.error(
        `WebSocket shutdown error: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}
