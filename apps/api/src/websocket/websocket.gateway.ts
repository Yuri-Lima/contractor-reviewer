import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { WorkspaceService } from '../workspace/workspace.service';
import { DocumentsService } from '../documents/documents.service';
import { WebSocketService } from './websocket.service';
import {
  type SubscribeDocumentPayload,
  documentRoom,
} from '@contractai-review/shared';

interface AuthenticatedSocket extends Socket {
  data: {
    userId?: string;
  };
}

@WebSocketGateway({
  namespace: '/',
  cors: { origin: true },
})
export class WebSocketGatewayHandler
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(WebSocketGatewayHandler.name);

  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly workspaceService: WorkspaceService,
    private readonly documentsService: DocumentsService,
    private readonly webSocketService: WebSocketService,
  ) {}

  afterInit(server: Server): void {
    this.webSocketService.setServer(server);
    this.logger.log('WebSocket gateway initialized');
  }

  handleConnection(client: AuthenticatedSocket): void {
    const token =
      client.handshake.auth?.token ?? client.handshake.query?.token;
    if (!token || typeof token !== 'string') {
      this.logger.warn('WS connection refused: no token');
      client.disconnect(true);
      return;
    }

    try {
      const secret =
        this.configService.get<string>('JWT_SECRET') ||
        'change-me-in-production-min-32-chars';
      const payload = this.jwtService.verify<{ sub: string }>(token, { secret });
      (client as AuthenticatedSocket).data = { userId: payload.sub };
    } catch {
      this.logger.warn('WS connection refused: invalid token');
      client.disconnect(true);
      return;
    }

    this.logger.debug(`WS connected: ${client.id}`);
  }

  handleDisconnect(client: AuthenticatedSocket): void {
    this.logger.debug(`WS disconnected: ${client.id}`);
  }

  @SubscribeMessage('subscribe')
  async handleSubscribe(
    client: AuthenticatedSocket,
    payload: SubscribeDocumentPayload,
  ): Promise<{ event: string; data?: { error: string } }> {
    const userId = (client as AuthenticatedSocket).data?.userId;
    if (!userId) {
      return { event: 'error', data: { error: 'Not authenticated' } };
    }

    const { workspaceId, documentId } = payload;
    if (!workspaceId || !documentId) {
      return { event: 'error', data: { error: 'workspaceId and documentId required' } };
    }

    try {
      await this.workspaceService.verifyMembership(workspaceId, userId);
      await this.documentsService.findById(documentId, workspaceId);
    } catch {
      return { event: 'error', data: { error: 'Access denied' } };
    }

    const room = documentRoom(workspaceId, documentId);
    await client.join(room);
    this.logger.debug(`Client ${client.id} joined ${room}`);
    return { event: 'subscribed' };
  }

  @SubscribeMessage('unsubscribe')
  async handleUnsubscribe(
    client: AuthenticatedSocket,
    payload: SubscribeDocumentPayload,
  ): Promise<void> {
    const { workspaceId, documentId } = payload;
    if (workspaceId && documentId) {
      await client.leave(documentRoom(workspaceId, documentId));
    }
  }
}
