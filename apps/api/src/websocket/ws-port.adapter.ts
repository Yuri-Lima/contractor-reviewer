import { IoAdapter } from '@nestjs/platform-socket.io';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import type IORedis from 'ioredis';
import { WS_SHUTDOWN_REGISTRY } from './ws-shutdown.registry';

export interface WsPortAdapterOptions {
  wsPort: number;
  redis: IORedis;
  /** Allowed CORS origins for production. If empty, uses origin: true (allow all). */
  corsOrigins?: string[];
}

/**
 * Custom IoAdapter that runs Socket.IO on a separate HTTP server and port (e.g. 3200).
 * Uses Redis adapter for horizontal scaling.
 */
export class WsPortIoAdapter extends IoAdapter {
  private wsPort: number;
  private redisClient: IORedis;
  private corsOrigins: string[];
  private wsHttpServer: ReturnType<typeof createServer> | null = null;

  constructor(app: unknown, options: WsPortAdapterOptions) {
    super(app);
    this.wsPort = options.wsPort;
    this.redisClient = options.redis;
    this.corsOrigins = options.corsOrigins ?? [];
  }

  createIOServer(_port: number, options?: object): Server {
    const httpServer = createServer();
    this.wsHttpServer = httpServer;

    const pubClient = this.redisClient.duplicate();
    const subClient = this.redisClient.duplicate();

    const cors =
      this.corsOrigins.length > 0
        ? { origin: this.corsOrigins, credentials: true }
        : { origin: true };

    const io = new Server(httpServer, {
      ...options,
      cors,
      path: '/socket.io',
    });

    io.adapter(createAdapter(pubClient, subClient));
    httpServer.listen(this.wsPort, () => {
      console.log(`WebSocket server listening on port ${this.wsPort}`);
    });

    WS_SHUTDOWN_REGISTRY.register(async () => {
      await new Promise<void>((resolve, reject) => {
        if (this.wsHttpServer) {
          this.wsHttpServer.close((err) => {
            this.wsHttpServer = null;
            if (err) reject(err);
            else resolve();
          });
        } else {
          resolve();
        }
      });
      await Promise.all([pubClient.quit(), subClient.quit()]);
    });

    return io;
  }
}
