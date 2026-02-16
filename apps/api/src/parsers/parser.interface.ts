import { DocumentParser } from '@contractai-review/shared';
import { ParseResult } from '@contractai-review/shared';

export interface ParserOptions {
  apiKey?: string;
  timeout?: number;
}

export interface DocumentParserAdapter {
  readonly id: DocumentParser;
  parse(
    fileBuffer: Buffer,
    mimeType: string,
    options?: ParserOptions,
  ): Promise<ParseResult>;
  isSupported(mimeType: string): boolean;
}
