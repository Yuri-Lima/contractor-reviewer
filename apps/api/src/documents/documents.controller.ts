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
import { VersionService } from './version.service';
import { Document } from '../entities/document.entity';
import { DocumentFile } from '../entities/document-file.entity';
import { DocumentVersion } from '../entities/document-version.entity';
import { UploadValidator } from '../storage/upload-validator';
import { NoopMalwareScanner } from '../storage/malware-scanner.interface';
import { AuditService } from '../audit/audit.service';
import { AuditAction, TargetType } from '../entities/audit-log.entity';
import { RequestInfo } from '../common/decorators/request-info.decorator';

@Controller('workspaces/:workspaceId/documents')
@UseGuards(JwtAuthGuard, WorkspaceGuard)
export class DocumentsController {
  constructor(
    private documentsService: DocumentsService,
    private versionService: VersionService,
    private malwareScanner: NoopMalwareScanner,
    private auditService: AuditService,
  ) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(WorkspaceRole.MEMBER, WorkspaceRole.ADMIN, WorkspaceRole.OWNER)
  @HttpCode(HttpStatus.CREATED)
  async createDocument(
    @WorkspaceId() workspaceId: string,
    @Body() createDto: { title: string; description?: string },
  ): Promise<Document> {
    return this.documentsService.create(workspaceId, createDto.title, createDto.description);
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
    @Body() updateDto: { title?: string; description?: string },
  ): Promise<Document> {
    return this.documentsService.update(documentId, workspaceId, updateDto);
  }

  @Get(':documentId')
  async getDocument(
    @WorkspaceId() workspaceId: string,
    @Param('documentId') documentId: string,
    @CurrentUser() user: { id: string },
    @RequestInfo() requestInfo: { ip: string; userAgent: string },
  ): Promise<Document> {
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
    @UploadedFile() file: { buffer: Buffer; originalname: string; mimetype: string; size: number },
    @Body() body: { parser?: string },
  ) {
    if (!file) {
      throw new BadRequestException('File is required');
    }

    // Validate file
    const validation = UploadValidator.validateFile(
      file.originalname,
      file.mimetype,
      file.size,
      file.buffer,
    );

    if (!validation.isValid) {
      throw new BadRequestException(validation.error);
    }

    // Scan for malware (noop for now)
    const scanResult = await this.malwareScanner.scanFile(file.buffer, file.originalname);
    if (!scanResult.safe) {
      throw new BadRequestException(`File rejected: ${scanResult.threat || 'Malware detected'}`);
    }

    const parser = body?.parser;
    const validParsers = ['dpt2', 'docling', 'llamaparse', 'unstructured', 'pdfplumber'];
    if (parser && !validParsers.includes(parser)) {
      throw new BadRequestException(`Invalid parser: ${parser}. Valid: ${validParsers.join(', ')}`);
    }
    const uploadedFile = await this.documentsService.uploadFile(documentId, workspaceId, file, parser);
    
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

  @Get(':documentId/versions')
  @UseGuards(RolesGuard)
  @Roles(WorkspaceRole.VIEWER, WorkspaceRole.MEMBER, WorkspaceRole.ADMIN, WorkspaceRole.OWNER)
  async getVersions(
    @WorkspaceId() workspaceId: string,
    @Param('documentId') documentId: string,
  ): Promise<DocumentVersion[]> {
    // Verify document exists and belongs to workspace
    await this.documentsService.findById(documentId, workspaceId);
    return this.versionService.getVersions(documentId, workspaceId);
  }

  @Get(':documentId/content')
  @UseGuards(RolesGuard)
  @Roles(WorkspaceRole.VIEWER, WorkspaceRole.MEMBER, WorkspaceRole.ADMIN, WorkspaceRole.OWNER)
  async getDocumentContent(
    @WorkspaceId() workspaceId: string,
    @Param('documentId') documentId: string,
  ): Promise<{ content: string; versionNumber: number; lastUpdated: Date }> {
    // Verify document exists and belongs to workspace
    await this.documentsService.findById(documentId, workspaceId);
    return this.versionService.getCurrentContent(documentId, workspaceId);
  }

  @Get(':documentId/versions/:versionId/content')
  @UseGuards(RolesGuard)
  @Roles(WorkspaceRole.VIEWER, WorkspaceRole.MEMBER, WorkspaceRole.ADMIN, WorkspaceRole.OWNER)
  async getVersionContent(
    @WorkspaceId() workspaceId: string,
    @Param('documentId') documentId: string,
    @Param('versionId') versionId: string,
  ): Promise<{ content: string; versionNumber: number; createdAt: Date }> {
    // Verify document exists and belongs to workspace
    await this.documentsService.findById(documentId, workspaceId);
    return this.versionService.getVersionContent(versionId, documentId, workspaceId);
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
    // If wasDeleted is false, document didn't exist (idempotent behavior)
  }
}
