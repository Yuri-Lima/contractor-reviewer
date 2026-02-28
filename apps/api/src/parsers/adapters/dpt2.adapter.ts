import { Injectable, Logger } from '@nestjs/common';
import {
  DocumentParser,
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
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/png',
  'image/jpeg',
]);

const LANDING_AI_URL = 'https://api.va.landing.ai/v1/ade/parse';

@Injectable()
export class Dpt2Adapter implements DocumentParserAdapter {
  readonly id = DocumentParser.DPT2;
  private readonly logger = new Logger(Dpt2Adapter.name);

  isSupported(mimeType: string): boolean {
    return SUPPORTED_MIMES.has(mimeType);
  }

  async parse(
    fileBuffer: Buffer,
    mimeType: string,
    options?: ParserOptions,
  ): Promise<ParseResult> {
    if (!this.isSupported(mimeType)) {
      throw new Error(`DPT-2 does not support mime type: ${mimeType}`);
    }

    const apiKey = options?.apiKey;
    if (!apiKey) {
      throw new Error(
        'DPT-2 requires an API key. Add it in Workspace Settings > Document Parsers.',
      );
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
    formData.append('document', blob, `document${ext}`);

    try {
      const res = await fetch(LANDING_AI_URL, {
        method: 'POST',
        body: formData,
        signal,
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      });

      clearTimeout(timeoutId);

      if (res.status === 401 || res.status === 403) {
        throw new Error(
          'API key for DPT-2 is invalid or expired. Update it in Workspace Settings.',
        );
      }

      if (!res.ok) {
        const text = await res.text();
        throw new Error(
          `DPT-2 parse failed: ${res.status} ${res.statusText} - ${text}`,
        );
      }

      const data = (await res.json()) as {
        markdown: string;
        metadata?: { page_count?: number };
      };

      return {
        markdown: data.markdown ?? '',
        pageCount: data.metadata?.page_count ?? null,
        metadata: data.metadata ?? undefined,
      };
    } catch (err) {
      if (err instanceof Error) {
        if (err.name === 'AbortError') {
          throw new Error(
            `DPT-2 parse timed out after ${timeout}ms. Try a different parser.`,
          );
        }
        if (
          err.message?.includes('API key') ||
          err.message?.includes('invalid') ||
          err.message?.includes('expired')
        ) {
          throw err;
        }
      }
      const cause = getUnderlyingCause(err);
      this.logger.warn(
        'DPT-2 request failed',
        cause ? { cause } : undefined,
      );
      throw new Error(toUserFriendlyParserError('DPT-2', err));
    }
  }

  private getExtension(mimeType: string): string {
    const map: Record<string, string> = {
      'application/pdf': '.pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
        '.docx',
      'image/png': '.png',
      'image/jpeg': '.jpg',
    };
    return map[mimeType] ?? '.bin';
  }
}
