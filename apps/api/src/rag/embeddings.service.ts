import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OpenAI } from 'openai';
import { arrayToVectorString } from '../vector-helpers';

@Injectable()
export class EmbeddingsService {
  private readonly openai: OpenAI;
  private readonly model: string;
  private readonly batchSize = 100; // Process in batches to avoid rate limits

  constructor(private configService: ConfigService) {
    const apiKey = this.configService.get<string>('OPENAI_API_KEY');

    if (!apiKey) {
      console.warn('OPENAI_API_KEY not set - embeddings will fail');
    }

    this.openai = new OpenAI({
      apiKey: apiKey || 'dummy-key', // Will fail at runtime if not set
    });
    this.model = this.configService.get<string>('OPENAI_EMBEDDING_MODEL') || 'text-embedding-3-small';
  }

  /**
   * Generate embedding for a single text
   */
  async generateEmbedding(text: string): Promise<number[]> {
    try {
      const response = await this.openai.embeddings.create({
        model: this.model,
        input: text,
      });

      return response.data[0].embedding;
    } catch (error) {
      throw new Error(`Failed to generate embedding: ${error.message}`);
    }
  }

  /**
   * Generate embeddings for multiple texts (batched)
   */
  async generateEmbeddings(
    texts: string[],
    options?: { signal?: AbortSignal },
  ): Promise<number[][]> {
    if (texts.length === 0) {
      return [];
    }

    const embeddings: number[][] = [];

    // Process in batches
    for (let i = 0; i < texts.length; i += this.batchSize) {
      const batch = texts.slice(i, i + this.batchSize);

      try {
        const response = await this.openai.embeddings.create(
          {
            model: this.model,
            input: batch,
          },
          { signal: options?.signal },
        );

        const batchEmbeddings = response.data.map((item: { embedding: number[] }) => item.embedding);
        embeddings.push(...batchEmbeddings);
      } catch (error) {
        throw new Error(`Failed to generate embeddings batch: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    return embeddings;
  }

  /**
   * Convert embedding array to PostgreSQL vector format
   */
  embeddingToVector(embedding: number[]): string {
    return arrayToVectorString(embedding);
  }
}
