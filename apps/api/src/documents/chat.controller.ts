import {
  Controller,
  Post,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { WorkspaceGuard, RolesGuard } from '../workspace/guards';
import { Roles } from '../workspace/decorators/roles.decorator';
import { WorkspaceRole } from '../entities/workspace-member.entity';
import { WorkspaceId, CurrentUser } from '../workspace/decorators';
import { RagService, RagResponse } from '../rag/rag.service';
import { DocumentsService } from './documents.service';
import { AuditService } from '../audit/audit.service';
import { AuditAction, TargetType } from '@contractai-review/shared';
import { RequestInfo } from '../common/decorators/request-info.decorator';
import { ChatMessageService } from './chat-message.service';
import { TranscriptionService } from '../transcription/transcription.service';
import { AuthService } from '../auth/auth.service';
import { AudioValidator } from '../transcription/audio-validator';
import { WorkspaceSettingsService } from '../workspace/workspace-settings.service';
import { RateLimit } from '../rate-limit/rate-limit.decorator';
import { RateLimitGuard } from '../rate-limit/rate-limit.guard';
import { TranscribeBodyDto } from './dto/transcribe-body.dto';

@Controller('workspaces/:workspaceId/documents/:documentId/chat')
@UseGuards(JwtAuthGuard, WorkspaceGuard, RolesGuard)
@Roles(WorkspaceRole.MEMBER, WorkspaceRole.ADMIN, WorkspaceRole.OWNER, WorkspaceRole.VIEWER)
export class ChatController {
  constructor(
    private ragService: RagService,
    private documentsService: DocumentsService,
    private auditService: AuditService,
    private chatMessageService: ChatMessageService,
    private transcriptionService: TranscriptionService,
    private workspaceSettingsService: WorkspaceSettingsService,
    private authService: AuthService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  async chat(
    @WorkspaceId() workspaceId: string,
    @Param('documentId') documentId: string,
    @CurrentUser() user: { id: string },
    @RequestInfo() requestInfo: { ip: string; userAgent: string },
    @Body() chatDto: { question: string; language?: string },
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
        chatDto.language || 'en', // Pass language, default to 'en'
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

  @Post('transcribe')
  @UseGuards(RateLimitGuard)
  @RateLimit({ requestsPerMinute: 15 })
  @UseInterceptors(FileInterceptor('audio'))
  @HttpCode(HttpStatus.OK)
  async transcribe(
    @WorkspaceId() workspaceId: string,
    @Param('documentId') documentId: string,
    @CurrentUser() user: { id: string },
    @RequestInfo() requestInfo: { ip: string; userAgent: string },
    @UploadedFile() file: { buffer: Buffer; originalname: string; mimetype: string; size: number } | undefined,
    @Body() body: TranscribeBodyDto,
  ): Promise<{ text: string }> {
    if (!file) {
      throw new BadRequestException('Audio file is required');
    }
    const validation = AudioValidator.validate(
      file.originalname,
      file.mimetype,
      file.size,
      file.buffer,
    );
    if (!validation.isValid) {
      throw new BadRequestException(validation.error);
    }
    const effectiveMimeType = AudioValidator.getEffectiveMimeType(file.mimetype, file.buffer);
    try {
      await this.documentsService.findById(documentId, workspaceId);

      const resolved =
        await this.workspaceSettingsService.resolveEffectiveTranscriptionProvider(
          workspaceId,
          () => this.transcriptionService.getDefaultProviderId(),
        );
      if (!resolved) {
        throw new BadRequestException(
          'No API key configured for transcription. Add your key in Workspace Settings → Voice.',
        );
      }

      const result = await this.transcriptionService.transcribe(file.buffer, effectiveMimeType, {
        language: body.language || 'en',
        providerId: resolved.providerId,
        apiKey: resolved.apiKey,
      });
      await this.auditService.createAuditLog(
        workspaceId,
        user.id,
        AuditAction.VOICE_TRANSCRIBE,
        TargetType.DOCUMENT,
        documentId,
        requestInfo.ip,
        requestInfo.userAgent,
        { sizeBytes: file.size, provider: result.provider },
      );
      return { text: result.text };
    } catch (err) {
      if (err instanceof BadRequestException) {
        throw err;
      }
      const message = err instanceof Error ? err.message : 'Transcription failed';
      console.error('Transcribe error (workspaceId, documentId):', workspaceId, documentId, message);
      // Always surface the real error message; only use generic fallback if empty
      const userMessage =
        message?.trim() || 'Transcription failed. Check your API key in Workspace Settings → Voice.';
      throw new BadRequestException(userMessage);
    }
  }
}
