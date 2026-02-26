import { IsOptional, IsString, Matches } from 'class-validator';

export class TranscribeBodyDto {
  @IsOptional()
  @IsString()
  @Matches(/^[a-z]{2}(-[A-Za-z]{2,})?$/, {
    message: 'Invalid language code',
  })
  language?: string;
}
