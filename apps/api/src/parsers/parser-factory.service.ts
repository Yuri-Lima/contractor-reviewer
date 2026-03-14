import { Injectable } from '@nestjs/common';
import {
  DocumentParser,
  ParserInfo,
} from '@contractai-review/shared';
import { DocumentParserAdapter, ParserOptions } from './parser.interface';
import { DoclingAdapter } from './adapters/docling.adapter';
import { PdfplumberAdapter } from './adapters/pdfplumber.adapter';
import { Dpt2Adapter } from './adapters/dpt2.adapter';
import { LlamaParseAdapter } from './adapters/llamaparse.adapter';
import { UnstructuredAdapter } from './adapters/unstructured.adapter';
import { WorkspaceSettingsService } from '../workspace/workspace-settings.service';

/** Docling is the primary parser; used as fallback when preferred parser is unavailable. */
export const PRIMARY_PARSER = DocumentParser.DOCLING;

const PARSERS_REQUIRING_API_KEY = new Set<DocumentParser>([
  DocumentParser.DPT2,
  DocumentParser.LLAMAPARSE,
  DocumentParser.UNSTRUCTURED,
]);

const PARSER_REGISTRY: Record<
  DocumentParser,
  { name: string; description: string; supportedFormats: string[] }
> = {
  [DocumentParser.DPT2]: {
    name: 'DPT-2 (LandingAI)',
    description: 'Document Pre-trained Transformer by LandingAI. High quality, requires API key.',
    supportedFormats: ['pdf', 'docx', 'png', 'jpg'],
  },
  [DocumentParser.DOCLING]: {
    name: 'Docling',
    description: 'IBM Docling. Self-hosted, no API key. PDF, DOC, DOCX, PPTX, XLSX, images.',
    supportedFormats: ['pdf', 'doc', 'docx', 'pptx', 'xlsx', 'png', 'jpg', 'tiff', 'bmp', 'webp'],
  },
  [DocumentParser.LLAMAPARSE]: {
    name: 'LlamaParse',
    description: 'LlamaIndex document parser. Requires API key.',
    supportedFormats: ['pdf', 'docx'],
  },
  [DocumentParser.UNSTRUCTURED]: {
    name: 'Unstructured.io',
    description: 'Unstructured API. Requires API key. Many formats.',
    supportedFormats: ['pdf', 'docx', 'png', 'jpg', 'txt'],
  },
  [DocumentParser.PDFPLUMBER]: {
    name: 'PDFPlumber',
    description: 'Classic PDF extraction. Self-hosted, PDF only.',
    supportedFormats: ['pdf'],
  },
};

@Injectable()
export class ParserFactoryService {
  constructor(
    private doclingAdapter: DoclingAdapter,
    private pdfplumberAdapter: PdfplumberAdapter,
    private dpt2Adapter: Dpt2Adapter,
    private llamaParseAdapter: LlamaParseAdapter,
    private unstructuredAdapter: UnstructuredAdapter,
    private workspaceSettingsService: WorkspaceSettingsService,
  ) {}

  getPrimaryParser(): DocumentParserAdapter {
    return this.getParser(PRIMARY_PARSER);
  }

  getParser(parserId: DocumentParser): DocumentParserAdapter {
    const map: Record<DocumentParser, DocumentParserAdapter> = {
      [DocumentParser.DOCLING]: this.doclingAdapter,
      [DocumentParser.PDFPLUMBER]: this.pdfplumberAdapter,
      [DocumentParser.DPT2]: this.dpt2Adapter,
      [DocumentParser.LLAMAPARSE]: this.llamaParseAdapter,
      [DocumentParser.UNSTRUCTURED]: this.unstructuredAdapter,
    };
    const adapter = map[parserId];
    if (!adapter) {
      throw new Error(`Unknown parser: ${parserId}`);
    }
    return adapter;
  }

  async getParserWithApiKey(
    parserId: DocumentParser,
    workspaceId: string,
  ): Promise<{ adapter: DocumentParserAdapter; options: ParserOptions }> {
    const adapter = this.getParser(parserId);
    const options: ParserOptions = { timeout: 60000 };

    if (PARSERS_REQUIRING_API_KEY.has(parserId)) {
      try {
        const apiKey = await this.workspaceSettingsService.getDecryptedApiKey(
          workspaceId,
          parserId,
        );
        if (!apiKey) {
          throw new Error(
            `Parser ${PARSER_REGISTRY[parserId]?.name ?? parserId} requires an API key. Add it in Workspace Settings > Document Parsers.`,
          );
        }
        options.apiKey = apiKey;
      } catch (err) {
        if (err instanceof Error) {
          throw err;
        }
        throw new Error(String(err));
      }
    }

    return { adapter, options };
  }

  /**
   * Get parser with fallback to primary (Docling) when preferred is unavailable.
   * Use when preferred parser may lack API key or not support the mime type.
   */
  async getParserWithFallback(
    mimeType: string,
    preferredId: DocumentParser | undefined,
    workspaceId: string,
  ): Promise<{ adapter: DocumentParserAdapter; options: ParserOptions; parserId: DocumentParser }> {
    const parserId = preferredId ?? (await this.getDefaultParser(workspaceId));
    try {
      const { adapter, options } = await this.getParserWithApiKey(parserId, workspaceId);
      if (adapter.isSupported(mimeType)) {
        return { adapter, options, parserId };
      }
    } catch {
      // Preferred unavailable or unsupported - fall through to primary
    }
    const primaryAdapter = this.getPrimaryParser();
    if (primaryAdapter.isSupported(mimeType)) {
      const { adapter, options } = await this.getParserWithApiKey(PRIMARY_PARSER, workspaceId);
      return { adapter, options, parserId: PRIMARY_PARSER };
    }
    throw new Error(
      `Parser ${parserId} is unavailable and primary parser (Docling) does not support mime type: ${mimeType}`,
    );
  }

  private async getDefaultParser(workspaceId: string): Promise<DocumentParser> {
    const settings = await this.workspaceSettingsService.getSettings(workspaceId);
    const parser = settings.documentProcessing?.defaultDocumentParser ?? PRIMARY_PARSER;
    return parser as DocumentParser;
  }

  async listParsers(workspaceId: string): Promise<ParserInfo[]> {
    const settings = await this.workspaceSettingsService.getSettings(workspaceId);
    const maskedKeys = settings.documentProcessing?.parserApiKeys ?? {};

    return (Object.values(DocumentParser) as DocumentParser[]).map((id) => {
      const meta = PARSER_REGISTRY[id];
      return {
        id,
        name: meta.name,
        description: meta.description,
        requiresApiKey: PARSERS_REQUIRING_API_KEY.has(id),
        supportedFormats: meta.supportedFormats,
        hasApiKeyConfigured: maskedKeys[id] === true,
      };
    });
  }
}
