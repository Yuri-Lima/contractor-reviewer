import {
  Controller,
  Get,
  Put,
  Delete,
  Param,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { WorkspaceGuard, RolesGuard } from '../workspace/guards';
import { Roles } from '../workspace/decorators/roles.decorator';
import { WorkspaceRole } from '../entities/workspace-member.entity';
import { WorkspaceId } from '../workspace/decorators';
import { PromptService, PROMPT_KEYS } from '../prompts/prompt.service';
import { DocumentsService } from './documents.service';

const VALID_KEYS = new Set(PROMPT_KEYS);

function validateKey(key: string): void {
  if (!VALID_KEYS.has(key as (typeof PROMPT_KEYS)[number])) {
    throw new BadRequestException(
      `Invalid prompt key: ${key}. Valid keys: ${PROMPT_KEYS.join(', ')}`,
    );
  }
}

/** DTO for upserting a prompt */
class UpsertPromptDto {
  content!: string;
  variant?: string;
}

@Controller('workspaces/:workspaceId/documents/:documentId/prompts')
@UseGuards(JwtAuthGuard, WorkspaceGuard, RolesGuard)
@Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN)
export class DocumentPromptsController {
  constructor(
    private readonly promptService: PromptService,
    private readonly documentsService: DocumentsService,
  ) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  async listPrompts(
    @WorkspaceId() workspaceId: string,
    @Param('documentId') documentId: string,
  ) {
    await this.documentsService.findById(documentId, workspaceId);
    const prompts = await this.promptService.listPromptsForDocument(
      workspaceId,
      documentId,
    );
    return { prompts };
  }

  @Get(':key')
  @HttpCode(HttpStatus.OK)
  async getPrompt(
    @WorkspaceId() workspaceId: string,
    @Param('documentId') documentId: string,
    @Param('key') key: string,
  ) {
    validateKey(key);
    await this.documentsService.findById(documentId, workspaceId);
    const content = await this.promptService.getPrompt(key, {
      workspaceId,
      documentId,
      variant: 'default',
    });
    const list = await this.promptService.listPromptsForDocument(
      workspaceId,
      documentId,
    );
    const item = list.find((p) => p.key === key);
    return {
      key,
      content,
      source: item?.source ?? 'global',
      description: item?.description,
      updatedAt: item?.updatedAt,
    };
  }

  @Put(':key')
  @HttpCode(HttpStatus.OK)
  async upsertPrompt(
    @WorkspaceId() workspaceId: string,
    @Param('documentId') documentId: string,
    @Param('key') key: string,
    @Body() dto: UpsertPromptDto,
  ) {
    validateKey(key);
    const content = (dto?.content ?? '').trim();
    if (!content) {
      throw new BadRequestException('Prompt content cannot be empty');
    }
    await this.documentsService.findById(documentId, workspaceId);
    const prompt = await this.promptService.upsertPrompt(key, content, {
      workspaceId,
      documentId,
      variant: dto?.variant ?? 'default',
    });
    return {
      key: prompt.key,
      content: prompt.content,
      source: 'document' as const,
      description: (prompt.metadata as { description?: string })?.description,
      updatedAt: prompt.updatedAt,
    };
  }

  @Delete(':key')
  @HttpCode(HttpStatus.NO_CONTENT)
  async resetPrompt(
    @WorkspaceId() workspaceId: string,
    @Param('documentId') documentId: string,
    @Param('key') key: string,
  ) {
    validateKey(key);
    await this.documentsService.findById(documentId, workspaceId);
    await this.promptService.resetDocumentPrompt(workspaceId, documentId, key);
  }
}
