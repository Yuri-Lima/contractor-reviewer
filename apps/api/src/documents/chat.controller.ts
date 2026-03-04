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
  NotFoundException,
  Res,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { WorkspaceGuard, RolesGuard } from '../workspace/guards';
import { Roles } from '../workspace/decorators/roles.decorator';
import { WorkspaceRole } from '../entities/workspace-member.entity';
import { WorkspaceId, CurrentUser } from '../workspace/decorators';
import { RagService, RagResponse } from '../rag/rag.service';
import { DocumentsService } from './documents.service';
import { AuditService } from '../audit/audit.service';
import { AuditAction, ChatPrepareResponse, TargetType, TtsProviderId } from '@contractai-review/shared';
import { RequestInfo } from '../common/decorators/request-info.decorator';
import { ReqAbortSignal } from '../common/decorators/req-abort-signal.decorator';
import { ChatMessageService } from './chat-message.service';
import { TranscriptionService } from '../transcription/transcription.service';
import { TtsService } from '../tts/tts.service';
import { AuthService } from '../auth/auth.service';
import { AudioValidationService } from '../transcription/audio-validation.service';
import { WorkspaceSettingsService } from '../workspace/workspace-settings.service';
import { RateLimit } from '../rate-limit/rate-limit.decorator';
import { RateLimitGuard } from '../rate-limit/rate-limit.guard';
import { TranscribeBodyDto } from './dto/transcribe-body.dto';
import { ChatExecuteBodyDto } from './dto/chat-execute-body.dto';

@Controller('workspaces/:workspaceId/documents/:documentId/chat')
@UseGuards(JwtAuthGuard, WorkspaceGuard, RolesGuard)
@Roles(WorkspaceRole.MEMBER, WorkspaceRole.ADMIN, WorkspaceRole.OWNER, WorkspaceRole.VIEWER)
export class ChatController {
  private readonly logger = new Logger(ChatController.name);

  constructor(
    private ragService: RagService,
    private documentsService: DocumentsService,
    private auditService: AuditService,
    private chatMessageService: ChatMessageService,
    private transcriptionService: TranscriptionService,
    private ttsService: TtsService,
    private workspaceSettingsService: WorkspaceSettingsService,
    private authService: AuthService,
    private audioValidationService: AudioValidationService,
    private configService: ConfigService,
  ) {}

  private isPrepareEnabled(): boolean {
    return this.configService.get<string>('CHAT_PREPARE_ENABLED') !== 'false';
  }

  /** Log real error details (name, message, stack, cause, HTTP response when present). */
  private logError(
    operation: string,
    context: { workspaceId?: string; documentId?: string },
    err: unknown,
  ): void {
    const ctx = Object.entries(context)
      .filter(([, v]) => v != null)
      .map(([k, v]) => `${k}=${v}`)
      .join(', ');
    const base = `[${operation}] ${ctx}`;

    if (err instanceof Error) {
      this.logger.error(`${base} error="${err.message}" name=${err.name}`);
      if (err.stack) {
        this.logger.error(`${base} stack: ${err.stack}`);
      }
      const cause = (err as Error & { cause?: unknown }).cause;
      if (cause instanceof Error) {
        this.logger.error(`${base} cause: ${cause.message} (${cause.name})`);
        if (cause.stack) {
          this.logger.error(`${base} cause stack: ${cause.stack}`);
        }
      } else if (cause != null) {
        this.logger.error(`${base} cause=${JSON.stringify(cause)}`);
      }
      // Axios/fetch-style HTTP errors
      const res = (err as { response?: { status?: number; data?: unknown } }).response;
      if (res) {
        const dataPreview =
          typeof res.data === 'object' && res.data !== null
            ? JSON.stringify(res.data).slice(0, 500)
            : String(res.data ?? '').slice(0, 200);
        this.logger.error(`${base} response status=${res.status} data=${dataPreview}`);
      }
    } else {
      this.logger.error(`${base} error=${String(err)}`);
    }
  }

  @Post()
  @HttpCode(HttpStatus.OK)
  async chat(
    @WorkspaceId() workspaceId: string,
    @Param('documentId') documentId: string,
    @CurrentUser() user: { id: string },
    @RequestInfo() requestInfo: { ip: string; userAgent: string },
    @ReqAbortSignal() signal: AbortSignal,
    @Body() chatDto: { question: string; language?: string; forceFresh?: boolean },
  ): Promise<RagResponse> {
    try {
      // Verify document exists and belongs to workspace
      const document = await this.documentsService.findById(documentId, workspaceId);

      if (!chatDto.question || !chatDto.question.trim()) {
        throw new Error('Question is required');
      }

      // Use resolved jurisdiction if available
      const jurisdiction = document.resolvedJurisdiction || undefined;

      const similarityThreshold = await this.authService.getRagCacheSimilarityThreshold(user.id);

      // Generate answer with RAG
      const response = await this.ragService.generateAnswer(
        chatDto.question.trim(),
        documentId,
        workspaceId,
        jurisdiction,
        chatDto.language || 'en',
        {
          signal,
          forceFresh: chatDto.forceFresh,
          similarityThreshold,
        },
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
          fromCache: response.fromCache,
        },
      );
      
      return response;
    } catch (error) {
      // Never log question content or answer text
      this.logError('Chat', { documentId, workspaceId }, error);
      throw error;
    }
  }

  @Post('prepare')
  @UseGuards(RateLimitGuard)
  @RateLimit({ requestsPerMinute: 15 })
  @HttpCode(HttpStatus.OK)
  async prepare(
    @WorkspaceId() workspaceId: string,
    @Param('documentId') documentId: string,
    @ReqAbortSignal() signal: AbortSignal,
    @Body() chatDto: { question: string; language?: string; forceFresh?: boolean },
  ): Promise<ChatPrepareResponse> {
    if (!this.isPrepareEnabled()) {
      throw new NotFoundException();
    }
    try {
      const document = await this.documentsService.findById(documentId, workspaceId);

      if (!chatDto.question || !chatDto.question.trim()) {
        throw new Error('Question is required');
      }

      const jurisdiction = document.resolvedJurisdiction || undefined;

      return await this.ragService.prepareForChat(
        chatDto.question.trim(),
        documentId,
        workspaceId,
        jurisdiction,
        chatDto.language || 'en',
        { signal },
      );
    } catch (error) {
      this.logError('ChatPrepare', { documentId, workspaceId }, error);
      throw error;
    }
  }

  @Post('execute')
  @UseGuards(RateLimitGuard)
  @RateLimit({ requestsPerMinute: 15 })
  @HttpCode(HttpStatus.OK)
  async execute(
    @WorkspaceId() workspaceId: string,
    @Param('documentId') documentId: string,
    @CurrentUser() user: { id: string },
    @RequestInfo() requestInfo: { ip: string; userAgent: string },
    @ReqAbortSignal() signal: AbortSignal,
    @Body() body: ChatExecuteBodyDto,
  ): Promise<RagResponse> {
    if (!this.isPrepareEnabled()) {
      throw new NotFoundException();
    }
    try {
      const document = await this.documentsService.findById(documentId, workspaceId);
      const jurisdiction = document.resolvedJurisdiction || undefined;

      const { response, question } = await this.ragService.executePreparedChat(
        workspaceId,
        documentId,
        body.requestId,
        { signal },
      );

      await this.chatMessageService.saveChatMessage(
        documentId,
        workspaceId,
        user.id,
        question,
        response,
        jurisdiction,
      );

      await this.auditService.createAuditLog(
        workspaceId,
        user.id,
        AuditAction.CHAT_QUERY,
        TargetType.DOCUMENT,
        documentId,
        requestInfo.ip,
        requestInfo.userAgent,
        {
          questionLength: question.length,
          hasAnswer: !!response.answerText,
          confidence: response.confidence,
          citationsCount: response.citations?.length || 0,
          fromCache: false,
        },
      );

      return response;
    } catch (error) {
      this.logError('ChatExecute', { documentId, workspaceId }, error);
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
    @ReqAbortSignal() signal: AbortSignal,
    @UploadedFile() file: { buffer: Buffer; originalname: string; mimetype: string; size: number } | undefined,
    @Body() body: TranscribeBodyDto,
  ): Promise<{ text: string }> {
    if (!file) {
      throw new BadRequestException('Audio file is required');
    }
    const options = { signal };
    const validation = await this.audioValidationService.validate(
      file.originalname,
      file.mimetype,
      file.size,
      file.buffer,
      options,
    );
    if (!validation.isValid) {
      throw new BadRequestException(validation.error);
    }
    const effectiveMimeType = await this.audioValidationService.getEffectiveMimeType(
      file.mimetype,
      file.buffer,
      options,
    );
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

      const result = await this.transcriptionService.transcribe(
        file.buffer,
        effectiveMimeType,
        {
          language: body.language || 'en',
          providerId: resolved.providerId,
          apiKey: resolved.apiKey,
          signal,
        },
      );
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
      this.logError('Transcribe', { workspaceId, documentId }, err);
      const message = err instanceof Error ? err.message : 'Transcription failed';
      const userMessage =
        message?.trim() || 'Transcription failed. Check your API key in Workspace Settings → Voice.';
      throw new BadRequestException(userMessage);
    }
  }

  @Post('synthesize')
  @UseGuards(RateLimitGuard)
  @RateLimit({ requestsPerMinute: 15 })
  @HttpCode(HttpStatus.OK)
  async synthesize(
    @WorkspaceId() workspaceId: string,
    @Param('documentId') documentId: string,
    @CurrentUser() user: { id: string },
    @RequestInfo() requestInfo: { ip: string; userAgent: string },
    @Res() res: Response,
    @Body() body: { text: string; language?: string },
    @ReqAbortSignal() signal: AbortSignal,
  ): Promise<void> {
    if (!body.text || !body.text.trim()) {
      throw new BadRequestException('Text is required');
    }
    try {
      await this.documentsService.findById(documentId, workspaceId);

      const resolved =
        await this.workspaceSettingsService.resolveEffectiveTtsProvider(workspaceId);
      if (!resolved) {
        throw new BadRequestException(
          'No API key configured for TTS. Add your key in Workspace Settings → Voice.',
        );
      }

      const buffer = await this.ttsService.synthesize(body.text.trim(), {
        providerId: resolved.providerId,
        apiKey: resolved.apiKey,
        language: body.language || 'en',
        providerConfig: resolved.config,
        signal,
      });

      await this.auditService.createAuditLog(
        workspaceId,
        user.id,
        AuditAction.TTS_SYNTHESIZE,
        TargetType.DOCUMENT,
        documentId,
        requestInfo.ip,
        requestInfo.userAgent,
        { sizeBytes: buffer.length, provider: resolved.providerId },
      );

      const elevenLabsPro = ['pro', 'scale', 'business'].includes(
        resolved.config?.plan?.toLowerCase() ?? '',
      );
      const contentType =
        resolved.providerId === TtsProviderId.ElevenLabs
          ? elevenLabsPro
            ? 'audio/wav'
            : 'audio/mpeg'
          : 'audio/wav';
      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Length', buffer.length);
      res.send(buffer);
    } catch (err) {
      if (err instanceof BadRequestException) {
        throw err;
      }
      this.logError('Synthesize', { workspaceId, documentId }, err);
      const message = err instanceof Error ? err.message : 'TTS synthesis failed';
      throw new BadRequestException(
        message.trim() || 'TTS failed. Check your API key in Workspace Settings → Voice.',
      );
    }
  }
}
