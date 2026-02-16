import { Injectable } from '@nestjs/common';
import {
  DocumentParser,
  ParseResult,
} from '@contractai-review/shared';
import { DocumentParserAdapter, ParserOptions } from '../parser.interface';

const SUPPORTED_MIMES = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

@Injectable()
export class LlamaParseAdapter implements DocumentParserAdapter {
  readonly id = DocumentParser.LLAMAPARSE;

  isSupported(mimeType: string): boolean {
    return SUPPORTED_MIMES.has(mimeType);
  }

  async parse(
    _fileBuffer: Buffer,
    mimeType: string,
    _options?: ParserOptions,
  ): Promise<ParseResult> {
    if (!this.isSupported(mimeType)) {
      throw new Error(`LlamaParse does not support mime type: ${mimeType}`);
    }
    throw new Error(
      'LlamaParse adapter is not yet implemented. Use Docling or PDFPlumber for now.',
    );
  }
}
