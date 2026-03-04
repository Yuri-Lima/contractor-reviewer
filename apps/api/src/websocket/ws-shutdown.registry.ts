/**
 * Registry for WebSocket adapter cleanup. The WsPortIoAdapter registers its
 * shutdown callback here; WsShutdownService runs it on application shutdown.
 */
export const WS_SHUTDOWN_REGISTRY = {
  shutdownCallback: null as (() => Promise<void>) | null,

  register(callback: () => Promise<void>): void {
    this.shutdownCallback = callback;
  },

  async run(): Promise<void> {
    if (this.shutdownCallback) {
      await this.shutdownCallback();
      this.shutdownCallback = null;
    }
  },
};
