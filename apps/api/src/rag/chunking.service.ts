import { Injectable, Logger } from '@nestjs/common';
import { ChunkingStrategy } from '@contractai-review/shared';

export interface Chunk {
  text: string;
  pageNumber?: number;
  paragraphId?: string;
  startIndex: number;
  endIndex: number;
}

@Injectable()
export class ChunkingService {
  private readonly logger = new Logger(ChunkingService.name);
  private readonly CHUNK_SIZE = 1000; // characters
  private readonly CHUNK_OVERLAP = 200; // characters overlap between chunks

  /**
   * Chunk text into smaller pieces for embedding.
   * Supports multiple strategies: paragraph, sentence, fixed_size.
   * semantic and agentic fall back to paragraph until implemented.
   */
  chunkText(
    text: string,
    pageNumber?: number,
    strategy: string = ChunkingStrategy.PARAGRAPH,
  ): Chunk[] {
    const effectiveStrategy = this.resolveStrategy(strategy);
    switch (effectiveStrategy) {
      case ChunkingStrategy.PARAGRAPH:
        return this.chunkByParagraph(text, pageNumber);
      case ChunkingStrategy.SENTENCE:
        return this.chunkBySentences(text, pageNumber);
      case ChunkingStrategy.FIXED_SIZE:
        return this.chunkByFixedSize(text, pageNumber);
      default:
        return this.chunkByParagraph(text, pageNumber);
    }
  }

  private resolveStrategy(strategy: string): string {
    if (
      strategy === ChunkingStrategy.SEMANTIC ||
      strategy === ChunkingStrategy.AGENTIC
    ) {
      this.logger.warn(
        `Chunking strategy "${strategy}" not yet implemented, falling back to paragraph`,
      );
      return ChunkingStrategy.PARAGRAPH;
    }
    return strategy;
  }

  /**
   * Chunk by paragraph boundaries, with size limit and overlap
   */
  private chunkByParagraph(text: string, pageNumber?: number): Chunk[] {
    const chunks: Chunk[] = [];
    let currentIndex = 0;

    // Split by paragraphs first
    const paragraphs = text.split(/\n\s*\n/);

    let accumulatedText = '';
    let accumulatedStart = 0;

    for (const paragraph of paragraphs) {
      const trimmedParagraph = paragraph.trim();

      if (!trimmedParagraph) {
        continue;
      }

      // If adding this paragraph would exceed chunk size, save current chunk
      if (
        accumulatedText &&
        accumulatedText.length + trimmedParagraph.length > this.CHUNK_SIZE
      ) {
        chunks.push({
          text: accumulatedText.trim(),
          pageNumber,
          paragraphId: `para-${chunks.length + 1}`,
          startIndex: accumulatedStart,
          endIndex: currentIndex - trimmedParagraph.length,
        });

        // Start new chunk with overlap
        const overlapText = accumulatedText.slice(-this.CHUNK_OVERLAP);
        accumulatedText = overlapText + ' ' + trimmedParagraph;
        accumulatedStart = currentIndex - this.CHUNK_OVERLAP;
      } else {
        accumulatedText += (accumulatedText ? '\n\n' : '') + trimmedParagraph;
      }

      currentIndex += paragraph.length + 2; // +2 for paragraph separator
    }

    // Add remaining text as final chunk
    if (accumulatedText.trim()) {
      chunks.push({
        text: accumulatedText.trim(),
        pageNumber,
        paragraphId: `para-${chunks.length + 1}`,
        startIndex: accumulatedStart,
        endIndex: currentIndex,
      });
    }

    // If no paragraphs found, split by sentences
    if (chunks.length === 0) {
      return this.chunkBySentences(text, pageNumber);
    }

    return chunks;
  }

  /**
   * Chunk by sentences, merging up to CHUNK_SIZE with overlap
   */
  private chunkBySentences(text: string, pageNumber?: number): Chunk[] {
    const chunks: Chunk[] = [];
    const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];

    let currentChunk = '';
    let currentStart = 0;
    let currentIndex = 0;

    for (const sentence of sentences) {
      if (currentChunk.length + sentence.length > this.CHUNK_SIZE) {
        if (currentChunk) {
          chunks.push({
            text: currentChunk.trim(),
            pageNumber,
            paragraphId: `chunk-${chunks.length + 1}`,
            startIndex: currentStart,
            endIndex: currentIndex - sentence.length,
          });
        }

        // Start new chunk with overlap
        const overlapText = currentChunk.slice(-this.CHUNK_OVERLAP);
        currentChunk = overlapText + ' ' + sentence;
        currentStart = currentIndex - this.CHUNK_OVERLAP;
      } else {
        currentChunk += sentence;
      }

      currentIndex += sentence.length;
    }

    // Add remaining chunk
    if (currentChunk.trim()) {
      chunks.push({
        text: currentChunk.trim(),
        pageNumber,
        paragraphId: `chunk-${chunks.length + 1}`,
        startIndex: currentStart,
        endIndex: currentIndex,
      });
    }

    return chunks;
  }

  /**
   * Chunk by fixed character count with overlap (no boundary awareness)
   */
  private chunkByFixedSize(text: string, pageNumber?: number): Chunk[] {
    const chunks: Chunk[] = [];
    let start = 0;

    while (start < text.length) {
      const end = Math.min(start + this.CHUNK_SIZE, text.length);
      const chunkText = text.slice(start, end);

      if (chunkText.trim()) {
        chunks.push({
          text: chunkText.trim(),
          pageNumber,
          paragraphId: `chunk-${chunks.length + 1}`,
          startIndex: start,
          endIndex: end,
        });
      }

      if (end >= text.length) break;
      start = end - this.CHUNK_OVERLAP;
      if (start < 0) start = 0;
    }

    return chunks;
  }

  /**
   * Chunk multiple pages
   */
  chunkPages(
    pages: Array<{ pageNumber: number; text: string }>,
    strategy: string = ChunkingStrategy.PARAGRAPH,
  ): Chunk[] {
    const allChunks: Chunk[] = [];

    for (const page of pages) {
      const pageChunks = this.chunkText(page.text, page.pageNumber, strategy);
      allChunks.push(...pageChunks);
    }

    return allChunks;
  }
}
