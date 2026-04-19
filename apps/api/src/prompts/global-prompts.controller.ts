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
import { PromptService, GLOBAL_PROMPT_KEY } from './prompt.service';

function validateKey(key: string): void {
  if (key !== GLOBAL_PROMPT_KEY) {
    throw new BadRequestException(
      `Invalid prompt key: ${key}. Valid key: ${GLOBAL_PROMPT_KEY}`,
    );
  }
}

/** DTO for upserting a prompt */
class UpsertPromptDto {
  content!: string;
  variant?: string;
}

@Controller('account/prompts')
@UseGuards(JwtAuthGuard)
export class GlobalPromptsController {
  constructor(private readonly promptService: PromptService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  async listPrompts() {
    const prompts = await this.promptService.listGlobalPrompts();
    return { prompts };
  }

  @Get(':key')
  @HttpCode(HttpStatus.OK)
  async getPrompt(@Param('key') key: string) {
    validateKey(key);
    const list = await this.promptService.listGlobalPrompts();
    const item = list.find((p) => p.key === key);
    const content =
      item?.content ??
      (await this.promptService.getPrompt(GLOBAL_PROMPT_KEY, {
        variant: 'default',
      }));
    return {
      key,
      content,
      source: 'global' as const,
      description: item?.description,
      updatedAt: item?.updatedAt,
    };
  }

  @Put(':key')
  @HttpCode(HttpStatus.OK)
  async upsertPrompt(@Param('key') key: string, @Body() dto: UpsertPromptDto) {
    validateKey(key);
    const content = (dto?.content ?? '').trim();
    if (!content) {
      throw new BadRequestException('Prompt content cannot be empty');
    }
    const prompt = await this.promptService.upsertGlobalPrompt(
      GLOBAL_PROMPT_KEY,
      content,
    );
    return {
      key: prompt.key,
      content: prompt.content,
      source: 'global' as const,
      description: (prompt.metadata as { description?: string })?.description,
      updatedAt: prompt.updatedAt,
    };
  }

  @Delete(':key')
  @HttpCode(HttpStatus.NO_CONTENT)
  async resetPrompt(@Param('key') key: string) {
    validateKey(key);
    await this.promptService.resetGlobalPrompt(GLOBAL_PROMPT_KEY);
  }
}
