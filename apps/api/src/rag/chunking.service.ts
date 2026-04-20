import { Injectable, Logger } from '@nestjs/common';
import { ChunkingStrategy } from '@contractai-review/shared';
import { lexer, type Token, type Tokens } from 'marked';

export interface Chunk {
  text: string;
  pageNumber?: number;
  paragraphId?: string;
  startIndex: number;
  endIndex: number;
  /**
   * Numeric clause id extracted from the nearest enclosing heading
   * (e.g. "9.1.3"). Null when the chunk's section is unnumbered or the
   * input isn't markdown-structured.
   */
  clauseNumber?: string | null;
  /**
   * Breadcrumb of headings that govern this chunk, ordered shallow → deep
   * (e.g. ["9. Pension", "9.1 Auto-enrolment", "9.1.3 Contributions"]).
   */
  headingPath?: string[] | null;
}

/**
 * Matches a leading clause/section number such as "9", "9.1", "9.1.3", "9.1.3.4"
 * (optionally with a trailing dot). Captures the digits-and-dots run only.
 */
const CLAUSE_NUMBER_RE = /^\s*((?:\d+)(?:\.\d+){0,5})\.?\s+/;

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
   * Chunk by paragraph boundaries, with size limit and overlap.
   *
   * Splits text into logical paragraphs using a structural pass:
   * - Markdown-aware (headings, list items, tables, fenced code) when the text
   *   looks like Markdown.
   * - Heuristic blank-line + single-newline + indentation detection otherwise.
   *
   * The downstream size/overlap accumulation matches the original behavior.
   */
  private chunkByParagraph(text: string, pageNumber?: number): Chunk[] {
    const chunks: Chunk[] = [];
    let currentIndex = 0;

    const normalized = this.normalizeText(text);
    const isMarkdown = this.looksLikeMarkdown(normalized);
    // For markdown we keep the heading metadata alongside each block so the
    // accumulator can attach `clauseNumber` / `headingPath` to every chunk.
    // For plain prose we still emit blocks but with empty metadata.
    const blocks = isMarkdown
      ? this.splitMarkdownBlocksWithHeadings(normalized)
      : this.splitHeuristicParagraphs(normalized).map((raw) => ({
          raw,
          clauseNumber: null as string | null,
          headingPath: null as string[] | null,
          isHeading: false,
        }));

    let accumulatedText = '';
    let accumulatedStart = 0;
    let accumulatedClause: string | null = null;
    let accumulatedHeading: string[] | null = null;

    const flush = (endIndex: number, currentBlockLength = 0) => {
      if (!accumulatedText.trim()) return;
      chunks.push({
        text: accumulatedText.trim(),
        pageNumber,
        paragraphId: `para-${chunks.length + 1}`,
        startIndex: accumulatedStart,
        endIndex: endIndex - currentBlockLength,
        clauseNumber: accumulatedClause,
        headingPath: accumulatedHeading,
      });
      accumulatedText = '';
    };

    for (const block of blocks) {
      const trimmedParagraph = block.raw.trim();
      if (!trimmedParagraph) continue;

      // A single block (code fence, wide table, very long quoted clause) can
      // exceed the configured chunk size. Flush whatever is accumulated and
      // emit the oversized block via the fixed-size splitter so we never
      // silently drop content or produce a single huge chunk.
      if (trimmedParagraph.length > this.CHUNK_SIZE * 1.5) {
        flush(currentIndex);

        const oversizedChunks = this.chunkByFixedSize(
          trimmedParagraph,
          pageNumber,
        );
        for (const oversized of oversizedChunks) {
          chunks.push({
            ...oversized,
            paragraphId: `para-${chunks.length + 1}`,
            startIndex: currentIndex + oversized.startIndex,
            endIndex: currentIndex + oversized.endIndex,
            clauseNumber: block.clauseNumber,
            headingPath: block.headingPath,
          });
        }

        currentIndex += block.raw.length + 2;
        accumulatedStart = currentIndex;
        accumulatedClause = block.clauseNumber;
        accumulatedHeading = block.headingPath;
        continue;
      }

      // If adding this paragraph would exceed chunk size, save current chunk
      if (
        accumulatedText &&
        accumulatedText.length + trimmedParagraph.length > this.CHUNK_SIZE
      ) {
        flush(currentIndex, trimmedParagraph.length);

        // Start new chunk with overlap, inheriting the new block's heading
        // metadata so the next chunk's clauseNumber tracks the document's
        // current section rather than the previous one.
        const overlapText = accumulatedText.slice(-this.CHUNK_OVERLAP);
        accumulatedText = overlapText + ' ' + trimmedParagraph;
        accumulatedStart = currentIndex - this.CHUNK_OVERLAP;
        accumulatedClause = block.clauseNumber;
        accumulatedHeading = block.headingPath;
      } else {
        if (!accumulatedText) {
          // Starting a new accumulation — adopt this block's heading state.
          accumulatedClause = block.clauseNumber;
          accumulatedHeading = block.headingPath;
        }
        accumulatedText += (accumulatedText ? '\n\n' : '') + trimmedParagraph;
      }

      currentIndex += block.raw.length + 2; // +2 for paragraph separator
    }

    flush(currentIndex);

    // If no paragraphs found, split by sentences
    if (chunks.length === 0) {
      return this.chunkBySentences(text, pageNumber);
    }

    return chunks;
  }

  /**
   * Normalize line endings, tabs, and excessive blank-line runs so downstream
   * splitters can rely on consistent input.
   */
  private normalizeText(text: string): string {
    return text
      .replace(/\r\n?/g, '\n')
      .replace(/\t/g, '    ')
      .replace(/\n{3,}/g, '\n\n');
  }

  /**
   * Quick signal-based check for Markdown structure. We don't need to be
   * perfect here, only avoid running the lexer on plain prose.
   */
  private looksLikeMarkdown(text: string): boolean {
    return (
      /^#{1,6}\s+\S/m.test(text) ||
      /^\s*[-*+]\s+\S/m.test(text) ||
      /^\s*\d+\.\s+\S/m.test(text) ||
      /^```/m.test(text) ||
      /^\|.*\|\s*$/m.test(text)
    );
  }

  /**
   * Use the marked lexer to split text into block-level paragraphs.
   * - Headings, paragraphs, blockquotes, code blocks, tables, hr -> one block.
   * - Lists -> one block per list_item (so items don't stay glued).
   * - Whitespace tokens are dropped.
   */
  private splitMarkdownBlocks(text: string): string[] {
    return this.splitMarkdownBlocksWithHeadings(text).map((b) => b.raw);
  }

  /**
   * Variant of splitMarkdownBlocks that walks the token stream and remembers
   * the active heading hierarchy. Each emitted block carries the heading
   * breadcrumb that governs it; numeric headings (e.g. "9.1.3 Contributions")
   * also yield a `clauseNumber`.
   *
   * The stack is keyed by heading depth (h1=1 ... h6=6), so a deeper heading
   * pushes onto the stack and a shallower or same-depth heading pops back to
   * its level before pushing.
   */
  private splitMarkdownBlocksWithHeadings(text: string): Array<{
    raw: string;
    clauseNumber: string | null;
    headingPath: string[] | null;
    isHeading: boolean;
  }> {
    let tokens: Token[];
    try {
      tokens = lexer(text);
    } catch (err) {
      this.logger.warn(
        `Markdown lexer failed, falling back to heuristic split: ${
          (err as Error).message
        }`,
      );
      return this.splitHeuristicParagraphs(text).map((raw) => ({
        raw,
        clauseNumber: null,
        headingPath: null,
        isHeading: false,
      }));
    }

    const blocks: Array<{
      raw: string;
      clauseNumber: string | null;
      headingPath: string[] | null;
      isHeading: boolean;
    }> = [];

    // headingStack[i] = the most recent heading text seen at depth i+1.
    // We use a sparse array so a level-3 heading without a level-2 parent
    // still produces a single-entry path (matches PDF reality).
    const headingStack: Array<{ depth: number; text: string; clause: string | null }> = [];

    const currentClause = (): string | null => {
      // Deepest available numeric clause wins; fall back to shallower.
      for (let i = headingStack.length - 1; i >= 0; i--) {
        if (headingStack[i].clause) return headingStack[i].clause;
      }
      return null;
    };
    const currentPath = (): string[] | null =>
      headingStack.length > 0 ? headingStack.map((h) => h.text) : null;

    for (const token of tokens) {
      switch (token.type) {
        case 'space':
          continue;
        case 'heading': {
          const heading = token as Tokens.Heading;
          const headingText = heading.text.trim();
          const clauseMatch = CLAUSE_NUMBER_RE.exec(headingText);
          const clause = clauseMatch ? clauseMatch[1] : null;

          // Pop any stack entry at depth >= heading.depth — shallower or
          // same-depth heading replaces them.
          while (
            headingStack.length > 0 &&
            headingStack[headingStack.length - 1].depth >= heading.depth
          ) {
            headingStack.pop();
          }
          headingStack.push({ depth: heading.depth, text: headingText, clause });

          // Emit the heading line itself as a block so context retrieval can
          // still surface it; mark `isHeading` for downstream filtering.
          const raw = heading.raw.trim();
          if (raw) {
            blocks.push({
              raw,
              clauseNumber: currentClause(),
              headingPath: currentPath(),
              isHeading: true,
            });
          }
          break;
        }
        case 'list': {
          const list = token as Tokens.List;
          for (const item of list.items) {
            const raw = item.raw.trim();
            if (raw) {
              blocks.push({
                raw,
                clauseNumber: currentClause(),
                headingPath: currentPath(),
                isHeading: false,
              });
            }
          }
          break;
        }
        default: {
          const raw = (token as { raw?: string }).raw?.trim();
          if (raw) {
            blocks.push({
              raw,
              clauseNumber: currentClause(),
              headingPath: currentPath(),
              isHeading: false,
            });
          }
          break;
        }
      }
    }

    return blocks;
  }

  /**
   * Plain-text paragraph split:
   * 1. Blank-line separated blocks (the legacy behavior).
   * 2. For each block with no internal blank line and length above
   *    CHUNK_SIZE / 2, attempt to split on single newlines using two signals:
   *      - sentence-ending punctuation followed by a capitalized line, or
   *      - indentation-level change of 2+ spaces between adjacent lines.
   */
  private splitHeuristicParagraphs(text: string): string[] {
    const firstPass = text.split(/\n\s*\n+/);
    const result: string[] = [];

    for (const block of firstPass) {
      const trimmed = block.trim();
      if (!trimmed) continue;

      const hasInternalBlank = /\n\s*\n/.test(block);
      if (hasInternalBlank || trimmed.length <= this.CHUNK_SIZE / 2) {
        result.push(trimmed);
        continue;
      }

      const refined = this.splitOnSingleNewlines(trimmed);
      result.push(...refined);
    }

    return result;
  }

  /**
   * Walk the lines of a block and break it whenever a heuristic signal
   * (sentence end + capitalized next line, or indentation change) suggests a
   * new logical paragraph started without a blank line in between.
   */
  private splitOnSingleNewlines(block: string): string[] {
    const lines = block.split('\n');
    if (lines.length < 2) return [block];

    const buckets: string[][] = [[]];
    const indentOf = (line: string): number => {
      const match = /^(\s*)/.exec(line);
      return match ? match[1].length : 0;
    };
    const sentenceEnd = /[.!?]["')\]]?\s*$/;
    const capitalizedStart = /^\s*["'([]?[A-Z0-9]/;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (i === 0) {
        buckets[buckets.length - 1].push(line);
        continue;
      }

      const prev = lines[i - 1];
      const sentenceBreak =
        sentenceEnd.test(prev) && capitalizedStart.test(line);
      const indentBreak = Math.abs(indentOf(line) - indentOf(prev)) >= 2;

      if (sentenceBreak || indentBreak) {
        buckets.push([line]);
      } else {
        buckets[buckets.length - 1].push(line);
      }
    }

    return buckets
      .map((bucket) => bucket.join('\n').trim())
      .filter((s) => s.length > 0);
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
