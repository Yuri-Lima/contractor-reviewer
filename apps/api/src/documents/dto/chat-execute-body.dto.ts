import { IsString, IsOptional, MinLength, IsUUID } from 'class-validator';

export class ChatExecuteBodyDto {
  @IsString()
  @MinLength(1, { message: 'requestId is required' })
  requestId: string;

  @IsOptional()
  @IsUUID()
  threadId?: string;
}
