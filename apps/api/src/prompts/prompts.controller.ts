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
import { PromptService, WORKSPACE_PROMPT_KEY } from './prompt.service';

function validateKey(key: string): void {
  if (key !== WORKSPACE_PROMPT_KEY) {
    throw new BadRequestException(
      `Invalid prompt key: ${key}. Valid key: ${WORKSPACE_PROMPT_KEY}`,
    );
  }
}

/** DTO for upserting a prompt */
class UpsertPromptDto {
  content!: string;
  variant?: string;
}

@Controller('workspaces/:workspaceId/prompts')
@UseGuards(JwtAuthGuard, WorkspaceGuard, RolesGuard)
@Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN)
export class PromptsController {
  constructor(private readonly promptService: PromptService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  async listPrompts(@WorkspaceId() workspaceId: string) {
    const prompts = await this.promptService.listPromptsForWorkspace(workspaceId);
    return { prompts };
  }

  @Get(':key')
  @HttpCode(HttpStatus.OK)
  async getPrompt(@WorkspaceId() workspaceId: string, @Param('key') key: string) {
    validateKey(key);
    const [item] = await this.promptService.listPromptsForWorkspace(workspaceId);
    return {
      key: item.key,
      content: item.content,
      source: item.source,
      description: item.description,
      updatedAt: item.updatedAt,
    };
  }

  @Put(':key')
  @HttpCode(HttpStatus.OK)
  async upsertPrompt(
    @WorkspaceId() workspaceId: string,
    @Param('key') key: string,
    @Body() dto: UpsertPromptDto,
  ) {
    validateKey(key);
    const content = (dto?.content ?? '').trim();
    if (!content) {
      throw new BadRequestException('Prompt content cannot be empty');
    }
    const prompt = await this.promptService.upsertPrompt(
      WORKSPACE_PROMPT_KEY,
      content,
      {
        workspaceId,
        variant: dto?.variant ?? 'default',
      },
    );
    return {
      key: prompt.key,
      content: prompt.content,
      source: 'workspace' as const,
      description: (prompt.metadata as { description?: string })?.description,
      updatedAt: prompt.updatedAt,
    };
  }

  @Delete(':key')
  @HttpCode(HttpStatus.NO_CONTENT)
  async resetPrompt(@WorkspaceId() workspaceId: string, @Param('key') key: string) {
    validateKey(key);
    await this.promptService.resetPrompt(workspaceId, WORKSPACE_PROMPT_KEY);
  }
}
