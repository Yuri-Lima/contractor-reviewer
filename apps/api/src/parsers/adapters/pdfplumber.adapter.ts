import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DocumentParser,
  ParseResult,
} from '@contractai-review/shared';
import { DocumentParserAdapter, ParserOptions } from '../parser.interface';
import {
  toUserFriendlyParserError,
  getUnderlyingCause,
} from '../parse-error.helper';

const SUPPORTED_MIMES = new Set(['application/pdf']);

@Injectable()
export class PdfplumberAdapter implements DocumentParserAdapter {
  readonly id = DocumentParser.PDFPLUMBER;
  private readonly baseUrl: string;
  private readonly logger = new Logger(PdfplumberAdapter.name);

  constructor(private configService: ConfigService) {
    this.baseUrl =
      this.configService.get<string>('PDFPLUMBER_URL') ||
      'http://localhost:8001';
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
      throw new Error(`PDFPlumber does not support mime type: ${mimeType}`);
    }

    const timeout = options?.timeout ?? 60000;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const formData = new FormData();
    const blob = new Blob([new Uint8Array(fileBuffer)], { type: mimeType });
    formData.append('file', blob, 'document.pdf');

    try {
      const res = await fetch(`${this.baseUrl}/extract`, {
        method: 'POST',
        body: formData,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        const text = await res.text();
        throw new Error(
          `PDFPlumber extraction failed: ${res.status} ${res.statusText} - ${text}`,
        );
      }

      const data = (await res.json()) as {
        markdown: string;
        page_count?: number | null;
        metadata?: Record<string, unknown>;
      };

      return {
        markdown: data.markdown ?? '',
        pageCount: data.page_count ?? null,
        metadata: data.metadata ?? undefined,
      };
    } catch (err) {
      if (err instanceof Error) {
        if (err.name === 'AbortError') {
          throw new Error(
            `PDFPlumber extraction timed out after ${timeout}ms. Service may be unavailable.`,
          );
        }
      }
      const cause = getUnderlyingCause(err);
      this.logger.warn(
        `PDFPlumber unavailable: ${this.baseUrl}`,
        cause ? { cause } : undefined,
      );
      throw new Error(toUserFriendlyParserError('PDFPlumber', err));
    }
  }
}
