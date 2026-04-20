import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  HttpCode,
  HttpStatus,
  BadRequestException,
  Res,
  Logger,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { MAX_FILE_SIZE_BYTES } from '@contractai-review/shared';
import { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { WorkspaceGuard, RolesGuard } from '../workspace/guards';
import { Roles } from '../workspace/decorators/roles.decorator';
import { WorkspaceRole } from '../entities/workspace-member.entity';
import { WorkspaceId, CurrentUser } from '../workspace/decorators';
import { DocumentsService } from './documents.service';
import { Document } from '../entities/document.entity';
import { DocumentFile } from '../entities/document-file.entity';
import { DocumentUploadValidator } from '../storage/document-upload-validator.service';
import { NoopMalwareScanner } from '../storage/malware-scanner.interface';
import { AuditService } from '../audit/audit.service';
import { AuditAction, TargetType } from '../entities/audit-log.entity';
import { RequestInfo } from '../common/decorators/request-info.decorator';
import { ReqAbortSignal } from '../common/decorators/req-abort-signal.decorator';
import { RateLimit } from '../rate-limit/rate-limit.decorator';
import { RateLimitGuard } from '../rate-limit/rate-limit.guard';
import { PromptGeneratorService } from '../prompts/prompt-generator.service';
import { PromptService } from '../prompts/prompt.service';
import { GeneratePromptRequestDto } from './dto/generate-prompt-request.dto';
import { CreateDocumentDto } from './dto/create-document.dto';
import { getPromptCategoryById } from '@contractai-review/shared';
import { PROMPT_KEYS } from '../prompts/prompt.service';

@Controller('workspaces/:workspaceId/documents')
@UseGuards(JwtAuthGuard, WorkspaceGuard)
export class DocumentsController {
  private readonly logger = new Logger(DocumentsController.name);

  constructor(
    private documentsService: DocumentsService,
    private documentUploadValidator: DocumentUploadValidator,
    private malwareScanner: NoopMalwareScanner,
    private auditService: AuditService,
    private promptGeneratorService: PromptGeneratorService,
    private promptService: PromptService,
  ) {}

  @Post('generate-prompt')
  @UseGuards(RolesGuard, RateLimitGuard)
  @Roles(WorkspaceRole.MEMBER, WorkspaceRole.ADMIN, WorkspaceRole.OWNER)
  @RateLimit({ requestsPerMinute: 15 })
  @HttpCode(HttpStatus.OK)
  async generatePrompt(
    @WorkspaceId() workspaceId: string,
    @CurrentUser() user: { id: string },
    @RequestInfo() requestInfo: { ip: string; userAgent: string },
    @ReqAbortSignal() signal: AbortSignal,
    @Body() dto: GeneratePromptRequestDto,
  ): Promise<{ generatedPrompt: string }> {
    const generatedPrompt = await this.promptGeneratorService.generate(
      {
        target: 'document',
        title: dto.title.trim(),
        description: dto.description.trim(),
        contextMarkdown: dto.contextMarkdown?.trim() || undefined,
      },
      { signal },
    );
    await this.auditService.createAuditLog(
      workspaceId,
      user.id,
      AuditAction.PROMPT_GENERATE,
      TargetType.WORKSPACE,
      null,
      requestInfo.ip,
      requestInfo.userAgent,
      { target: 'document' },
    );
    return { generatedPrompt };
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(WorkspaceRole.MEMBER, WorkspaceRole.ADMIN, WorkspaceRole.OWNER)
  @HttpCode(HttpStatus.CREATED)
  async createDocument(
    @WorkspaceId() workspaceId: string,
    @Body() createDto: CreateDocumentDto,
  ): Promise<Document> {
    this.logger.log('[CreateDocument] Entry', {
      workspaceId,
      promptCategoryId: createDto.promptCategoryId,
    });
    const document = await this.documentsService.create(
      workspaceId,
      createDto.title,
      createDto.description,
      createDto.promptCategoryId,
    );
    this.logger.log('[CreateDocument] Created', {
      workspaceId,
      documentId: document.id,
      promptCategoryId: createDto.promptCategoryId,
    });

    const category = getPromptCategoryById(createDto.promptCategoryId);
    if (category) {
      for (const key of PROMPT_KEYS) {
        const content = category.prompts[key];
        if (content) {
          try {
            await this.promptService.upsertPrompt(key, content, {
              workspaceId,
              documentId: document.id,
              variant: 'default',
            });
          } catch (err) {
            // Best-effort: log metadata only, do not block creation
            this.logger.error(
              '[CreateDocument] Failed to upsert document prompt from category',
              { promptCategoryId: createDto.promptCategoryId, documentId: document.id, key },
            );
          }
        }
      }
    } else {
      const promptContent = createDto.documentChatSystemPrompt?.trim();
      if (promptContent) {
        try {
          await this.promptService.upsertPrompt('chat.system', promptContent, {
            workspaceId,
            documentId: document.id,
            variant: 'default',
          });
        } catch (err) {
          this.logger.error(
            '[CreateDocument] Failed to upsert document prompt',
            { documentId: document.id },
          );
        }
      }
    }
    return document;
  }

  @Get()
  @UseGuards(RolesGuard)
  @Roles(WorkspaceRole.VIEWER, WorkspaceRole.MEMBER, WorkspaceRole.ADMIN, WorkspaceRole.OWNER)
  async getDocuments(@WorkspaceId() workspaceId: string): Promise<Document[]> {
    return this.documentsService.findAll(workspaceId);
  }

  @Patch(':documentId')
  @UseGuards(RolesGuard)
  @Roles(WorkspaceRole.MEMBER, WorkspaceRole.ADMIN, WorkspaceRole.OWNER)
  async updateDocument(
    @WorkspaceId() workspaceId: string,
    @Param('documentId') documentId: string,
    @CurrentUser() user: { id: string },
    @RequestInfo() requestInfo: { ip: string; userAgent: string },
    @Body()
    updateDto: {
      title?: string;
      description?: string;
      promptScopeIncludeDocument?: boolean;
      promptCategoryId?: string | null;
      resolvedJurisdiction?: string | null;
    },
  ): Promise<Document> {
    const document = await this.documentsService.update(documentId, workspaceId, updateDto);
    if (updateDto.resolvedJurisdiction !== undefined) {
      await this.auditService.createAuditLog(
        workspaceId,
        user.id,
        AuditAction.JURISDICTION_OVERRIDE,
        TargetType.DOCUMENT,
        documentId,
        requestInfo.ip,
        requestInfo.userAgent,
        { resolvedJurisdiction: document.resolvedJurisdiction ?? null },
      );
    }
    return document;
  }

  /**
   * Re-chunk an existing document using the current chunker. Used after the
   * heading-aware (Phase-2 legal-grade) chunker shipped, to backfill the
   * `clauseNumber` / `headingPath` columns on rows that pre-date it. Owner-
   * only because it deletes and re-creates all chunks for the document.
   */
  @Post(':documentId/reindex')
  @UseGuards(RolesGuard)
  @Roles(WorkspaceRole.OWNER)
  @HttpCode(HttpStatus.ACCEPTED)
  async reindexDocument(
    @WorkspaceId() workspaceId: string,
    @Param('documentId') documentId: string,
    @CurrentUser() user: { id: string },
    @RequestInfo() requestInfo: { ip: string; userAgent: string },
  ): Promise<{ enqueuedJobs: number; deletedChunks: number }> {
    const result = await this.documentsService.reindexChunks(documentId, workspaceId);
    await this.auditService.createAuditLog(
      workspaceId,
      user.id,
      AuditAction.OPEN_VIEW,
      TargetType.DOCUMENT,
      documentId,
      requestInfo.ip,
      requestInfo.userAgent,
      { reindex: true, ...result },
    );
    return result;
  }

  @Get(':documentId')
  async getDocument(
    @WorkspaceId() workspaceId: string,
    @Param('documentId') documentId: string,
    @CurrentUser() user: { id: string },
    @RequestInfo() requestInfo: { ip: string; userAgent: string },
  ): Promise<Document> {
    this.logger.log('[GetDocument] Entry', { workspaceId, documentId });
    const document = await this.documentsService.findById(documentId, workspaceId);
    
    // Log open/view action
    await this.auditService.createAuditLog(
      workspaceId,
      user.id,
      AuditAction.OPEN_VIEW,
      TargetType.DOCUMENT,
      documentId,
      requestInfo.ip,
      requestInfo.userAgent,
    );
    
    return document;
  }

  @Post(':documentId/files')
  @UseGuards(RolesGuard)
  @Roles(WorkspaceRole.MEMBER, WorkspaceRole.ADMIN, WorkspaceRole.OWNER)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_FILE_SIZE_BYTES },
    }),
  )
  @HttpCode(HttpStatus.CREATED)
  async uploadFile(
    @WorkspaceId() workspaceId: string,
    @Param('documentId') documentId: string,
    @CurrentUser() user: { id: string },
    @RequestInfo() requestInfo: { ip: string; userAgent: string },
    @ReqAbortSignal() signal: AbortSignal,
    @UploadedFile() file: { buffer: Buffer; originalname: string; mimetype: string; size: number },
    @Body() body: { parser?: string },
  ) {
    if (!file) {
      throw new BadRequestException('File is required');
    }

    this.logger.log('[UploadFile] Entry', {
      workspaceId,
      documentId,
      fileName: file.originalname,
      mimeType: file.mimetype,
      sizeBytes: file.size,
      parser: body?.parser,
    });

    const options = { signal };

    // Validate file
    const validation = await this.documentUploadValidator.validateFile(
      file.originalname,
      file.mimetype,
      file.size,
      file.buffer,
      options,
    );

    if (!validation.isValid) {
      throw new BadRequestException(validation.error);
    }

    // Scan for malware (noop for now)
    const scanResult = await this.malwareScanner.scanFile(file.buffer, file.originalname, options);
    if (!scanResult.safe) {
      throw new BadRequestException(`File rejected: ${scanResult.threat || 'Malware detected'}`);
    }

    const parser = body?.parser;
    const validParsers = ['dpt2', 'docling', 'llamaparse', 'unstructured', 'pdfplumber'];
    if (parser && !validParsers.includes(parser)) {
      throw new BadRequestException(`Invalid parser: ${parser}. Valid: ${validParsers.join(', ')}`);
    }
    const uploadedFile = await this.documentsService.uploadFile(
      documentId,
      workspaceId,
      file,
      parser,
      options,
    );
    this.logger.log('[UploadFile] Completed', {
      workspaceId,
      documentId,
      fileId: uploadedFile.id,
      fileName: file.originalname,
    });

    // Log upload action
    await this.auditService.createAuditLog(
      workspaceId,
      user.id,
      AuditAction.UPLOAD,
      TargetType.FILE,
      uploadedFile.id,
      requestInfo.ip,
      requestInfo.userAgent,
      { fileName: file.originalname, mimeType: file.mimetype, size: file.size, parser },
    );
    
    return uploadedFile;
  }

  @Get(':documentId/files/:fileId/content')
  @UseGuards(RolesGuard)
  @Roles(WorkspaceRole.VIEWER, WorkspaceRole.MEMBER, WorkspaceRole.ADMIN, WorkspaceRole.OWNER)
  async getFileContent(
    @WorkspaceId() workspaceId: string,
    @Param('documentId') documentId: string,
    @Param('fileId') fileId: string,
  ): Promise<{ content: string; fileName: string; parsedBy?: string }> {
    return this.documentsService.getFileContent(fileId, documentId, workspaceId);
  }

  @Get(':documentId/files/:fileId/download')
  @UseGuards(RolesGuard)
  @Roles(WorkspaceRole.MEMBER, WorkspaceRole.ADMIN, WorkspaceRole.OWNER, WorkspaceRole.VIEWER)
  async downloadFile(
    @WorkspaceId() workspaceId: string,
    @Param('documentId') documentId: string,
    @Param('fileId') fileId: string,
    @CurrentUser() user: { id: string },
    @RequestInfo() requestInfo: { ip: string; userAgent: string },
    @Res() res: Response,
  ): Promise<void> {
    // Verify document exists and belongs to workspace
    await this.documentsService.findById(documentId, workspaceId);
    
    // Get file
    const file = await this.documentsService.getFile(fileId, documentId, workspaceId);
    
    // Get download URL from storage service
    const downloadUrl = await this.documentsService.getFileDownloadUrl(file.storageKey);
    
    // Log download action
    await this.auditService.createAuditLog(
      workspaceId,
      user.id,
      AuditAction.DOWNLOAD,
      TargetType.FILE,
      fileId,
      requestInfo.ip,
      requestInfo.userAgent,
      { fileName: file.fileName, mimeType: file.mimeType, sizeBytes: file.sizeBytes },
    );
    
    // For local storage, serve file directly; for S3/R2, redirect to presigned URL
    if (downloadUrl.startsWith('/api/storage/')) {
      // Local storage: serve file directly
      const fileBuffer = await this.documentsService.getFileBuffer(file.storageKey);
      res.setHeader('Content-Type', file.mimeType);
      res.setHeader('Content-Disposition', `attachment; filename="${file.fileName}"`);
      res.send(fileBuffer);
    } else {
      // S3/R2: redirect to presigned URL
      res.redirect(downloadUrl);
    }
  }

  @Delete(':documentId/files/:fileId')
  @UseGuards(RolesGuard)
  @Roles(WorkspaceRole.MEMBER, WorkspaceRole.ADMIN, WorkspaceRole.OWNER)
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteFile(
    @WorkspaceId() workspaceId: string,
    @Param('documentId') documentId: string,
    @Param('fileId') fileId: string,
    @CurrentUser() user: { id: string },
    @RequestInfo() requestInfo: { ip: string; userAgent: string },
  ): Promise<void> {
    const { fileName } = await this.documentsService.deleteFile(
      documentId,
      fileId,
      workspaceId,
    );
    await this.auditService.createAuditLog(
      workspaceId,
      user.id,
      AuditAction.DELETE,
      TargetType.FILE,
      fileId,
      requestInfo.ip,
      requestInfo.userAgent,
      { fileName },
    );
  }

  @Get(':documentId/files')
  @UseGuards(RolesGuard)
  @Roles(WorkspaceRole.VIEWER, WorkspaceRole.MEMBER, WorkspaceRole.ADMIN, WorkspaceRole.OWNER)
  async getDocumentFiles(
    @WorkspaceId() workspaceId: string,
    @Param('documentId') documentId: string,
    @Query()
    query: {
      offset?: number;
      limit?: number;
      sortField?: string;
      sortOrder?: number;
      q?: string;
      fileName?: string;
      mimeType?: string;
      status?: string;
      searchMode?: 'fuzzy' | 'contains';
      similarityThreshold?: number;
      startDate?: string;
      endDate?: string;
    },
  ): Promise<{ files: DocumentFile[]; total: number; limit: number; offset: number }> {
    // Verify document exists and belongs to workspace
    await this.documentsService.findById(documentId, workspaceId);
    return this.documentsService.getDocumentFilesPaginated(documentId, query);
  }

  @Get(':documentId/jobs')
  async getDocumentJobs(
    @WorkspaceId() workspaceId: string,
    @Param('documentId') documentId: string,
  ) {
    // Verify document exists and belongs to workspace
    await this.documentsService.findById(documentId, workspaceId);
    return this.documentsService.getDocumentJobs(documentId);
  }

  @Get(':documentId/content')
  @UseGuards(RolesGuard)
  @Roles(WorkspaceRole.VIEWER, WorkspaceRole.MEMBER, WorkspaceRole.ADMIN, WorkspaceRole.OWNER)
  async getDocumentContent(
    @WorkspaceId() workspaceId: string,
    @Param('documentId') documentId: string,
  ): Promise<{ content: string; lastUpdated: Date }> {
    const document = await this.documentsService.findById(documentId, workspaceId);
    const content = await this.documentsService.getOriginalText(documentId, workspaceId);
    return { content, lastUpdated: document.updatedAt ?? new Date() };
  }

  @Post(':documentId/re-evaluate-jurisdiction')
  @UseGuards(RolesGuard, RateLimitGuard)
  @Roles(WorkspaceRole.MEMBER, WorkspaceRole.ADMIN, WorkspaceRole.OWNER)
  @RateLimit({ requestsPerMinute: 5 })
  @HttpCode(HttpStatus.ACCEPTED)
  async reEvaluateJurisdiction(
    @WorkspaceId() workspaceId: string,
    @Param('documentId') documentId: string,
  ): Promise<{ message: string }> {
    await this.documentsService.findById(documentId, workspaceId);
    await this.documentsService.reEvaluateJurisdiction(documentId, workspaceId);
    return { message: 'Jurisdiction re-evaluation queued' };
  }

  @Delete(':documentId')
  @UseGuards(RolesGuard)
  @Roles(WorkspaceRole.ADMIN, WorkspaceRole.OWNER)
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteDocument(
    @WorkspaceId() workspaceId: string,
    @Param('documentId') documentId: string,
    @CurrentUser() user: { id: string },
    @RequestInfo() requestInfo: { ip: string; userAgent: string },
  ): Promise<void> {
    this.logger.log('[DeleteDocument] Entry', { workspaceId, documentId });
    // Hard delete (idempotent - returns false if already deleted)
    const wasDeleted = await this.documentsService.delete(documentId, workspaceId);
    
    // Log delete action (only if document existed)
    if (wasDeleted) {
      await this.auditService.createAuditLog(
        workspaceId,
        user.id,
        AuditAction.DELETE,
        TargetType.DOCUMENT,
        documentId,
        requestInfo.ip,
        requestInfo.userAgent,
        { hardDelete: true },
      );
    }
    if (wasDeleted) {
      this.logger.log('[DeleteDocument] Document deleted', { workspaceId, documentId });
    }
  }
}
