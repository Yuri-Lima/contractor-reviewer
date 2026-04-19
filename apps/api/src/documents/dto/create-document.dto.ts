import { IsOptional, IsString, MaxLength, MinLength, IsIn } from 'class-validator';
import { PROMPT_CATEGORY_IDS } from '@contractai-review/shared';

export class CreateDocumentDto {
  @IsString()
  @MinLength(1, { message: 'Title is required' })
  @MaxLength(500)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  /** If provided, upserts chat.system document prompt after creation (legacy) */
  @IsOptional()
  @IsString()
  @MaxLength(65536)
  documentChatSystemPrompt?: string;

  /** If provided, upserts all 7 document prompts from the selected category */
  @IsOptional()
  @IsString()
  @IsIn(PROMPT_CATEGORY_IDS, {
    message: `promptCategoryId must be one of: ${PROMPT_CATEGORY_IDS.join(', ')}`,
  })
  promptCategoryId?: string;
}
