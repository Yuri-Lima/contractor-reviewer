import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { WorkspaceModule } from '../workspace/workspace.module';
import { DocumentsModule } from '../documents/documents.module';
import { QueueModule } from '../queue/queue.module';
import { WebSocketGatewayHandler } from './websocket.gateway';
import { WebSocketService } from './websocket.service';
import { JobProgressStreamConsumer } from './job-progress-stream.consumer';
import { WsShutdownService } from './ws-shutdown.service';

@Module({
  imports: [AuthModule, WorkspaceModule, DocumentsModule, QueueModule],
  providers: [
    WebSocketGatewayHandler,
    WebSocketService,
    JobProgressStreamConsumer,
    WsShutdownService,
  ],
  exports: [WebSocketService],
})
export class WebSocketModule {}
