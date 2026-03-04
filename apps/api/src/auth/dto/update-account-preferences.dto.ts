import { IsOptional, IsNumber, Min, Max, ValidateIf } from 'class-validator';

export class UpdateAccountPreferencesDto {
  @IsOptional()
  @ValidateIf((o) => o.ragCacheSimilarityThreshold != null)
  @IsNumber()
  @Min(0.8, { message: 'ragCacheSimilarityThreshold must be at least 0.8' })
  @Max(1, { message: 'ragCacheSimilarityThreshold must be at most 1' })
  ragCacheSimilarityThreshold?: number | null;
}
