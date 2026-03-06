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
    description: 'IBM Docling. Self-hosted, no API key. PDF, DOC, DOCX, images.',
    supportedFormats: ['pdf', 'doc', 'docx', 'png', 'jpg'],
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
