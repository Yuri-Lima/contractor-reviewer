import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DocumentParser,
  ParsingContext,
  ParseResult,
} from '@contractai-review/shared';
import { DocumentParserAdapter, ParserOptions } from '../parser.interface';
import {
  toUserFriendlyParserError,
  getUnderlyingCause,
} from '../parse-error.helper';
import { combineAbortSignals } from '../../common/utils/combine-abort-signals';

const SUPPORTED_MIMES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'image/png',
  'image/jpeg',
  'image/tiff',
  'image/bmp',
  'image/webp',
]);

@Injectable()
export class DoclingAdapter implements DocumentParserAdapter {
  readonly id = DocumentParser.DOCLING;
  private readonly baseUrl: string;
  private readonly logger = new Logger(DoclingAdapter.name);

  constructor(private configService: ConfigService) {
    this.baseUrl =
      this.configService.get<string>('DOCLING_URL') || 'http://localhost:8000';
  }

  isSupported(mimeType: string): boolean {
    return SUPPORTED_MIMES.has(mimeType);
  }

  async parse(
    fileBuffer: Buffer,
    mimeType: string,
    options?: ParserOptions,
  ): Promise<ParseResult> {
    if (!this.isSupported(mimeType)) {
      throw new Error(`Docling does not support mime type: ${mimeType}`);
    }

    const timeout = options?.timeout ?? 60000;
    const timeoutController = new AbortController();
    const timeoutId = setTimeout(() => timeoutController.abort(), timeout);
    const signal = combineAbortSignals([
      timeoutController.signal,
      options?.signal,
    ]);

    const formData = new FormData();
    const ext = this.getExtension(mimeType);
    const blob = new Blob([new Uint8Array(fileBuffer)], { type: mimeType });
    formData.append('file', blob, `document${ext}`);

    try {
      const res = await fetch(`${this.baseUrl}/convert`, {
        method: 'POST',
        body: formData,
        signal,
        headers: {}, // FormData sets Content-Type with boundary
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        const text = await res.text();
        throw new Error(
          `Docling conversion failed: ${res.status} ${res.statusText} - ${text}`,
        );
      }

      const data = (await res.json()) as {
        markdown: string;
        page_count?: number | null;
        metadata?: Record<string, unknown>;
      };

      const meta = data.metadata ?? {};
      const parserContext: ParsingContext = {
        parserId: 'docling',
        parserVersion: typeof meta.parser_version === 'string' ? meta.parser_version : undefined,
        pipelineMode: typeof meta.pipeline_mode === 'string' ? meta.pipeline_mode : undefined,
        usedOcr: typeof meta.used_ocr === 'boolean' ? meta.used_ocr : undefined,
        pageCount: data.page_count ?? (typeof meta.page_count === 'number' ? meta.page_count : undefined),
        exportFormat: 'markdown',
      };

      return {
        markdown: data.markdown ?? '',
        pageCount: data.page_count ?? null,
        metadata: data.metadata ?? undefined,
        parserContext,
      };
    } catch (err) {
      if (err instanceof Error) {
        if (err.name === 'AbortError') {
          const timeoutErr = new Error(
            `Docling conversion timed out after ${timeout}ms. Service may be unavailable.`,
          );
          (timeoutErr as Error & { cause?: unknown }).cause = err;
          throw timeoutErr;
        }
      }
      const cause = getUnderlyingCause(err);
      const causeCode = err && typeof err === 'object' && 'cause' in err
        ? (err as { cause?: { code?: string } }).cause?.code
        : undefined;
      const errCode = err && typeof err === 'object' && 'code' in err
        ? (err as { code?: string }).code
        : undefined;
      this.logger.warn(
        `Docling unavailable: ${this.baseUrl}`,
        { cause, causeCode, errCode, message: err instanceof Error ? err.message : String(err) },
      );
      const parserErr = new Error(toUserFriendlyParserError('Docling', err));
      (parserErr as Error & { cause?: unknown }).cause = err;
      throw parserErr;
    }
  }

  private getExtension(mimeType: string): string {
    const map: Record<string, string> = {
      'application/pdf': '.pdf',
      'application/msword': '.doc',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
        '.docx',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation':
        '.pptx',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
        '.xlsx',
      'image/png': '.png',
      'image/jpeg': '.jpg',
      'image/tiff': '.tiff',
      'image/bmp': '.bmp',
      'image/webp': '.webp',
    };
    return map[mimeType] ?? '.bin';
  }
}
