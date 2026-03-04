import { IsString, MinLength } from 'class-validator';

export class ChatExecuteBodyDto {
  @IsString()
  @MinLength(1, { message: 'requestId is required' })
  requestId: string;
}
