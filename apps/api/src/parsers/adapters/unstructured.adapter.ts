import { Injectable } from '@nestjs/common';
import {
  DocumentParser,
  ParseResult,
} from '@contractai-review/shared';
import { DocumentParserAdapter, ParserOptions } from '../parser.interface';

const SUPPORTED_MIMES = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/png',
  'image/jpeg',
  'text/plain',
]);

@Injectable()
export class UnstructuredAdapter implements DocumentParserAdapter {
  readonly id = DocumentParser.UNSTRUCTURED;

  isSupported(mimeType: string): boolean {
    return SUPPORTED_MIMES.has(mimeType);
  }

  async parse(
    _fileBuffer: Buffer,
    mimeType: string,
    _options?: ParserOptions,
  ): Promise<ParseResult> {
    if (!this.isSupported(mimeType)) {
      throw new Error(
        `Unstructured does not support mime type: ${mimeType}`,
      );
    }
    throw new Error(
      'Unstructured adapter is not yet implemented. Use Docling or PDFPlumber for now.',
    );
  }
}
