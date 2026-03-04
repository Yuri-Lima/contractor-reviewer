import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class GeneratePromptRequestDto {
  @IsString()
  @MinLength(1, { message: 'Title is required' })
  @MaxLength(500)
  title!: string;

  @IsString()
  @MinLength(1, { message: 'Description is required' })
  @MaxLength(2000)
  description!: string;

  @IsOptional()
  @IsString()
  @MaxLength(51200, {
    message: 'Context must not exceed 50KB',
  })
  contextMarkdown?: string;
}
