import {
  Controller,
  Post,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { WorkspaceGuard, RolesGuard } from '../workspace/guards';
import { Roles } from '../workspace/decorators/roles.decorator';
import { WorkspaceRole } from '../entities/workspace-member.entity';
import { WorkspaceId, CurrentUser } from '../workspace/decorators';
import { RagService, RagResponse } from '../rag/rag.service';
import { DocumentsService } from './documents.service';
import { AuditService } from '../audit/audit.service';
import { AuditAction, TargetType } from '../entities/audit-log.entity';
import { RequestInfo } from '../common/decorators/request-info.decorator';
import { ChatMessageService } from './chat-message.service';

@Controller('workspaces/:workspaceId/documents/:documentId/chat')
@UseGuards(JwtAuthGuard, WorkspaceGuard, RolesGuard)
@Roles(WorkspaceRole.MEMBER, WorkspaceRole.ADMIN, WorkspaceRole.OWNER, WorkspaceRole.VIEWER)
export class ChatController {
  constructor(
    private ragService: RagService,
    private documentsService: DocumentsService,
    private auditService: AuditService,
    private chatMessageService: ChatMessageService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  async chat(
    @WorkspaceId() workspaceId: string,
    @Param('documentId') documentId: string,
    @CurrentUser() user: { id: string },
    @RequestInfo() requestInfo: { ip: string; userAgent: string },
    @Body() chatDto: { question: string },
  ): Promise<RagResponse> {
    try {
      // Verify document exists and belongs to workspace
      const document = await this.documentsService.findById(documentId, workspaceId);

      if (!chatDto.question || !chatDto.question.trim()) {
        throw new Error('Question is required');
      }

      // Use resolved jurisdiction if available
      const jurisdiction = document.resolvedJurisdiction || undefined;

      // Generate answer with RAG
      const response = await this.ragService.generateAnswer(
        chatDto.question.trim(),
        documentId,
        workspaceId,
        jurisdiction,
      );
      
      // Save chat message (respects no-logs configuration)
      await this.chatMessageService.saveChatMessage(
        documentId,
        workspaceId,
        user.id,
        chatDto.question.trim(),
        response,
        jurisdiction,
      );
      
      // Log chat query (don't log the question content for privacy)
      await this.auditService.createAuditLog(
        workspaceId,
        user.id,
        AuditAction.CHAT_QUERY,
        TargetType.DOCUMENT,
        documentId,
        requestInfo.ip,
        requestInfo.userAgent,
        { 
          questionLength: chatDto.question.trim().length,
          hasAnswer: !!response.answerText,
          confidence: response.confidence,
          citationsCount: response.citations?.length || 0,
        },
      );
      
      return response;
    } catch (error) {
      // Never log question content or answer text
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('Chat error (documentId, workspaceId):', documentId, workspaceId, errorMessage);
      throw error;
    }
  }
}
