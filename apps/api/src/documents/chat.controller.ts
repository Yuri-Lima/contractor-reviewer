import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  Req,
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
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
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
import {
  AuditAction,
  ChatPrepareResponse,
  LEGAL_RAG_CATEGORY_ID,
  TargetType,
  TtsProviderId,
} from '@contractai-review/shared';
import { RequestInfo } from '../common/decorators/request-info.decorator';
import { ReqAbortSignal } from '../common/decorators/req-abort-signal.decorator';
import { ChatMessageService } from './chat-message.service';
import { ChatThreadService } from './chat-thread.service';
import { TranscriptionService } from '../transcription/transcription.service';
import { TtsService } from '../tts/tts.service';
import { AuthService } from '../auth/auth.service';
import { AudioValidationService } from '../transcription/audio-validation.service';
import { WorkspaceSettingsService } from '../workspace/workspace-settings.service';
import { RateLimit } from '../rate-limit/rate-limit.decorator';
import { RateLimitGuard } from '../rate-limit/rate-limit.guard';
import type { StreamEvent, Citation } from '@contractai-review/shared';
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
    private chatThreadService: ChatThreadService,
    private chatMessageService: ChatMessageService,
    private transcriptionService: TranscriptionService,
    private ttsService: TtsService,
    private workspaceSettingsService: WorkspaceSettingsService,
    private authService: AuthService,
    private audioValidationService: AudioValidationService,
    private configService: ConfigService,
    @InjectQueue('memory') private memoryQueue: Queue,
  ) {}

  private isPrepareEnabled(): boolean {
    return this.configService.get<string>('CHAT_PREPARE_ENABLED') !== 'false';
  }

  @Get('threads')
  async listThreads(
    @WorkspaceId() workspaceId: string,
    @Param('documentId') documentId: string,
    @CurrentUser() user: { id: string },
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    const result = await this.chatThreadService.listThreads(
      documentId,
      workspaceId,
      user.id,
      { page, limit },
    );
    return result;
  }

  @Post('threads')
  @HttpCode(HttpStatus.CREATED)
  async createThread(
    @WorkspaceId() workspaceId: string,
    @Param('documentId') documentId: string,
    @CurrentUser() user: { id: string },
    @Body() body: { title?: string },
  ) {
    return this.chatThreadService.createThread(
      documentId,
      workspaceId,
      user.id,
      body.title ?? null,
    );
  }

  @Get('threads/:threadId/messages')
  async getMessages(
    @WorkspaceId() workspaceId: string,
    @Param('documentId') documentId: string,
    @Param('threadId') threadId: string,
    @CurrentUser() user: { id: string },
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.chatMessageService.getMessages(threadId, workspaceId, user.id, {
      page,
      limit,
    });
  }

  @Get('threads/:threadId/export')
  async exportThread(
    @WorkspaceId() workspaceId: string,
    @Param('documentId') documentId: string,
    @Param('threadId') threadId: string,
    @CurrentUser() user: { id: string },
    @Res() res: Response,
  ): Promise<void> {
    const thread = await this.chatThreadService.findById(
      threadId,
      documentId,
      workspaceId,
      user.id,
    );
    const messages = await this.chatMessageService.getAllMessagesForExport(
      threadId,
      workspaceId,
      user.id,
    );

    const title = thread.title || messages[0]?.question?.slice(0, 60) || 'Conversation';
    const lines: string[] = [
      `# ${title}`,
      '',
      `*Exported ${new Date().toISOString()}*`,
      '',
      '---',
      '',
    ];

    for (const m of messages) {
      if (m.question) {
        lines.push('## User', '', m.question, '');
      }
      if (m.answerText) {
        lines.push('## Assistant', '', m.answerText, '');
      }
      lines.push('---', '');
    }

    const markdown = lines.join('\n');
    const safeTitle = title.replace(/[^a-zA-Z0-9-_]/g, '_').slice(0, 50);
    const filename = `chat-${safeTitle}-${threadId.slice(0, 8)}.md`;

    res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(markdown);
  }

  @Delete('threads/:threadId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteThread(
    @WorkspaceId() workspaceId: string,
    @Param('documentId') documentId: string,
    @Param('threadId') threadId: string,
    @CurrentUser() user: { id: string },
    @RequestInfo() requestInfo: { ip: string; userAgent: string },
    @Req() req: { workspaceMembership?: { role: WorkspaceRole } },
  ): Promise<void> {
    const role = req.workspaceMembership?.role ?? WorkspaceRole.VIEWER;
    const canDeleteAny =
      role === WorkspaceRole.ADMIN || role === WorkspaceRole.OWNER;

    const { messageCount } = await this.chatThreadService.deleteThread(
      threadId,
      documentId,
      workspaceId,
      user.id,
      canDeleteAny,
    );

    await this.auditService.createAuditLog(
      workspaceId,
      user.id,
      AuditAction.DELETE,
      TargetType.CHAT_THREAD,
      threadId,
      requestInfo.ip,
      requestInfo.userAgent,
      { documentId, messageCount },
    );
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

  @Post('stream')
  @UseGuards(RateLimitGuard)
  @RateLimit({ requestsPerMinute: 30 })
  async chatStream(
    @WorkspaceId() workspaceId: string,
    @Param('documentId') documentId: string,
    @CurrentUser() user: { id: string },
    @RequestInfo() requestInfo: { ip: string; userAgent: string },
    @ReqAbortSignal() signal: AbortSignal,
    @Res() res: Response,
    @Body() chatDto: {
      question: string;
      language?: string;
      forceFresh?: boolean;
      threadId?: string;
    },
  ): Promise<void> {
    try {
      const document = await this.documentsService.findById(documentId, workspaceId);

      if (!chatDto.question?.trim()) {
        res.status(400).json({ message: 'Question is required' });
        return;
      }

      const question = chatDto.question.trim();
      let threadId = chatDto.threadId;
      if (!threadId) {
        const thread = await this.chatThreadService.getOrCreateThread(
          documentId,
          workspaceId,
          user.id,
          question,
        );
        threadId = thread.id;
      } else {
        await this.chatThreadService.findById(
          threadId,
          documentId,
          workspaceId,
          user.id,
        );
      }

      // Use jurisdiction for Legal RAG only when category is Legal/Law and resolvedJurisdiction is set
      const jurisdiction =
        document.promptCategoryId === LEGAL_RAG_CATEGORY_ID && document.resolvedJurisdiction
          ? document.resolvedJurisdiction
          : undefined;
      const similarityThreshold = await this.authService.getRagCacheSimilarityThreshold(user.id);

      let conversationHistory: string | undefined;
      if (threadId) {
        const recent = await this.chatMessageService.getRecentMessages(
          threadId,
          workspaceId,
          user.id,
          5,
        );
        this.logger.log(
          `[ChatStream] Get recent messages for context: threadId=${threadId} count=${recent.length}`,
        );
        conversationHistory = recent
          .map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
          .join('\n');
        if (!conversationHistory) conversationHistory = undefined;
      }

      this.logger.log(
        `[ChatStream] Calling ragService.generateAnswerStream: documentId=${documentId} workspaceId=${workspaceId}`,
      );
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no');
      res.flushHeaders();

      let finalAnswerText = '';
      let finalConfidence: 'high' | 'medium' | 'low' = 'low';
      let finalCitations: Citation[] = [];
      let finalNotFound = false;
      let finalFromCache = false;
      let doneReceived = false;

      for await (const event of this.ragService.generateAnswerStream(
        question,
        documentId,
        workspaceId,
        jurisdiction,
        chatDto.language || 'en',
        {
          signal,
          forceFresh: chatDto.forceFresh,
          similarityThreshold,
          conversationHistory,
          threadId,
        },
      )) {
        if (event.type === 'chunk' || event.type === 'status') {
          res.write(`data: ${JSON.stringify(event)}\n\n`);
        } else if (event.type === 'done') {
          finalAnswerText = event.answerText;
          finalConfidence = event.confidence;
          finalCitations = event.citations;
          finalNotFound = event.notFound;
          finalFromCache = event.fromCache;
          doneReceived = true;
          res.write(`data: ${JSON.stringify(event)}\n\n`);
        } else if (event.type === 'error') {
          res.write(`data: ${JSON.stringify(event)}\n\n`);
          res.end();
          return;
        }
      }

      // Skip persist + audit if the client aborted mid-stream or no done event was emitted
      if (signal?.aborted || !doneReceived) {
        this.logger.log(
          `[ChatStream] Skip persist (aborted=${signal?.aborted ?? false} doneReceived=${doneReceived}): documentId=${documentId} threadId=${threadId}`,
        );
        res.end();
        return;
      }

      // Close the SSE connection immediately so the client isn't held open
      // while we persist. The `done` event was already written above.
      res.end();

      // Fire-and-forget: persist chat message + audit log in the background.
      // The Nest process stays alive to run these; errors are logged, not
      // propagated (the user already has the answer).
      this.logger.log(
        `[ChatStream] Calling chatMessageService.saveChatMessage: documentId=${documentId} threadId=${threadId} fromCache=${finalFromCache}`,
      );
      Promise.all([
        this.chatMessageService.saveChatMessage(
          documentId,
          workspaceId,
          user.id,
          question,
          {
            answerText: finalAnswerText,
            confidence: finalConfidence,
            citations: finalCitations,
            notFound: finalNotFound,
            fromCache: finalFromCache,
          },
          jurisdiction,
          threadId,
        ).then((saved) => {
          if (saved) {
            this.memoryQueue.add('summarize', { threadId, documentId, workspaceId }).catch(() => {});
          }
        }),
        this.auditService.createAuditLog(
          workspaceId,
          user.id,
          AuditAction.CHAT_QUERY,
          TargetType.DOCUMENT,
          documentId,
          requestInfo.ip,
          requestInfo.userAgent,
          {
            questionLength: question.length,
            threadId,
            hasAnswer: !!finalAnswerText,
            confidence: finalConfidence,
            citationsCount: finalCitations.length,
            fromCache: finalFromCache,
          },
        ),
      ]).catch((err) =>
        this.logger.error('[ChatStream] Post-stream persist failed', err),
      );
    } catch (error) {
      if (signal?.aborted) return;
      this.logError('ChatStream', { documentId, workspaceId }, error);
      try {
        res.write(
          `data: ${JSON.stringify({ type: 'error', message: error instanceof Error ? error.message : String(error) })}\n\n`,
        );
      } catch {
        /* ignore */
      }
      res.end();
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
    @Body() chatDto: { question: string; language?: string; forceFresh?: boolean; threadId?: string },
  ): Promise<ChatPrepareResponse> {
    if (!this.isPrepareEnabled()) {
      throw new NotFoundException();
    }
    try {
      this.logger.log('[ChatPrepare] Request', {
        documentId,
        workspaceId,
        questionLength: chatDto.question?.length ?? 0,
        language: chatDto.language ?? 'en',
      });
      const document = await this.documentsService.findById(documentId, workspaceId);

      if (!chatDto.question || !chatDto.question.trim()) {
        throw new Error('Question is required');
      }

      // Use jurisdiction for Legal RAG only when category is Legal/Law and resolvedJurisdiction is set
      const jurisdiction =
        document.promptCategoryId === LEGAL_RAG_CATEGORY_ID && document.resolvedJurisdiction
          ? document.resolvedJurisdiction
          : undefined;

      const result = await this.ragService.prepareForChat(
        chatDto.question.trim(),
        documentId,
        workspaceId,
        jurisdiction,
        chatDto.language || 'en',
        { signal, forceFresh: chatDto.forceFresh, threadId: chatDto.threadId },
      );
      this.logger.log('[ChatPrepare] Completed', {
        documentId,
        workspaceId,
        requestId: result.requestId,
      });
      return result;
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
      this.logger.log('[ChatExecute] Request', {
        documentId,
        workspaceId,
        requestId: body.requestId,
        threadId: body.threadId,
      });
      const document = await this.documentsService.findById(documentId, workspaceId);
      // Use jurisdiction for Legal RAG only when category is Legal/Law and resolvedJurisdiction is set
      const jurisdiction =
        document.promptCategoryId === LEGAL_RAG_CATEGORY_ID && document.resolvedJurisdiction
          ? document.resolvedJurisdiction
          : undefined;

      // Get or create thread (execute may provide threadId from prepare flow)
      let threadId = body.threadId;
      if (!threadId) {
        const thread = await this.chatThreadService.getOrCreateThread(
          documentId,
          workspaceId,
          user.id,
        );
        threadId = thread.id;
      } else {
        await this.chatThreadService.findById(
          threadId,
          documentId,
          workspaceId,
          user.id,
        );
      }

      const { response, question } = await this.ragService.executePreparedChat(
        workspaceId,
        documentId,
        body.requestId,
        { signal },
      );

      const savedExecute = await this.chatMessageService.saveChatMessage(
        documentId,
        workspaceId,
        user.id,
        question,
        response,
        jurisdiction,
        threadId,
      );
      if (savedExecute) {
        this.memoryQueue.add('summarize', { threadId, documentId, workspaceId }).catch(() => {});
      }

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
