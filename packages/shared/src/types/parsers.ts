import { DocumentParser } from '../enums/document-parser.enum';

export interface ParserInfo {
  id: DocumentParser;
  name: string;
  description: string;
  requiresApiKey: boolean;
  supportedFormats: string[];
  hasApiKeyConfigured?: boolean;
}

export interface ParseResult {
  markdown: string;
  pageCount?: number | null;
  metadata?: Record<string, unknown>;
}
