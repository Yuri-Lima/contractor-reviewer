import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { OpenAI } from 'openai';
import { Chunk } from '../entities/chunk.entity';
import { Embedding } from '../entities/embedding.entity';
import { Document } from '../entities/document.entity';
import { EmbeddingsService } from '../rag/embeddings.service';
import { RagService } from '../rag/rag.service';
import { RedlineChange, RedlinePlaybook } from '@contractai-review/shared';
import { DiffService } from './diff.service';
import { PromptService } from '../prompts/prompt.service';
import { arrayToVectorString } from '../vector-helpers';

@Injectable()
export class RedlineService {
  private readonly openaiClient: OpenAI;
  private readonly chatModel: string;

  constructor(
    @InjectRepository(Chunk)
    private chunkRepository: Repository<Chunk>,
    @InjectRepository(Embedding)
    private embeddingRepository: Repository<Embedding>,
    @InjectRepository(Document)
    private documentRepository: Repository<Document>,
    private embeddingsService: EmbeddingsService,
    private ragService: RagService,
    private diffService: DiffService,
    private promptService: PromptService,
    private configService: ConfigService,
  ) {
    const apiKey = this.configService.get<string>('OPENAI_API_KEY');
    if (!apiKey) {
      console.warn('OPENAI_API_KEY not set - redline generation will fail');
    }
    this.openaiClient = new OpenAI({ apiKey: apiKey || 'dummy-key' });
    this.chatModel = this.configService.get<string>('OPENAI_CHAT_MODEL') || 'gpt-4o-mini';
  }

  /**
   * Generate redline using AI + RAG
   */
  async generateRedline(
    selectedText: string,
    documentId: string,
    workspaceId: string,
    playbook: RedlinePlaybook,
    instructions?: string,
    objective?: string,
    pageNumber?: number,
    spanId?: string,
    language: string = 'en', // Add language parameter with default
  ): Promise<RedlineChange> {
    // Validate that selectedText exists in the document
    const selectedTextEmbedding = await this.embeddingsService.generateEmbedding(selectedText);
    
    // Search contract chunks using vector similarity
    const contractChunks = await this.searchContractChunks(selectedTextEmbedding, documentId, 5);

    // Check if we found the text
    if (contractChunks.length === 0) {
      return {
        section: 'Unknown',
        originalText: selectedText,
        suggestedText: selectedText,
        diffBlocks: [],
        explanation: this.getNotFoundMessage(language), // Use language-aware message
        confidence: 'low',
        citations: [],
        legalCitations: [],
        notFound: true,
      };
    }

    // Get document for context
    const document = await this.documentRepository.findOne({
      where: { id: documentId },
    });

    // Get jurisdiction if available
    const jurisdiction = document?.resolvedJurisdiction;

    // Search legal chunks if jurisdiction available
    const legalChunks = jurisdiction
      ? await this.searchLegalChunks(selectedTextEmbedding, undefined, jurisdiction, 3)
      : [];

    // Build context from chunks
    const contractContext = contractChunks
      .map((c, i) => `[Contract Excerpt ${i + 1}]: ${c.text}`)
      .join('\n\n');

    const legalContext = legalChunks
      .map((c, i) => `[Legal Source ${i + 1}]: ${c.text}`)
      .join('\n\n');

    const context = [contractContext, legalContext].filter(Boolean).join('\n\n');

    const languageName = this.promptService.getLanguageName(language);
    const playbookPrompt = await this.promptService.getPlaybookPrompt(playbook, { workspaceId });
    const { system, user } = await this.promptService.getRedlinePrompts(
      {
        languageName,
        playbookPrompt,
        selectedText,
        context: context || 'No additional context available.',
        objective: objective ? `\n\nObjective: ${objective}` : '',
        instructions: instructions ? `\n\nAdditional Instructions: ${instructions}` : '',
      },
      { workspaceId },
    );

    try {
      const response = await this.openaiClient.chat.completions.create({
        model: this.chatModel,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        temperature: 0.3,
        max_tokens: 1000,
        response_format: { type: 'json_object' },
      });

      const content = response.choices[0].message.content;
      if (!content) {
        throw new Error('Empty response from OpenAI');
      }

      const parsed = JSON.parse(content);
      const suggestedText = parsed.suggestedText || selectedText;
      const explanation = parsed.explanation || 'No explanation provided.';
      const citations = parsed.citations || [];
      const legalCitations = parsed.legalCitations || [];

      // Validate citations
      if (citations.length === 0 && legalCitations.length === 0) {
        const notFoundExplanation = this.getNoCitationsMessage(language);
        return {
          section: 'Unknown',
          originalText: selectedText,
          suggestedText,
          diffBlocks: [],
          explanation: notFoundExplanation,
          confidence: 'low',
          citations: [],
          legalCitations: [],
          notFound: true,
        };
      }

      // Generate diff blocks
      const diffBlocks = this.diffService.generateDiffBlocks(selectedText, suggestedText);

      // Determine confidence
      const hasGoodMatches =
        contractChunks.length > 0 && contractChunks[0].distance > 0.7;
      const hasLegalMatches = legalChunks.length > 0 && legalChunks[0].distance > 0.7;
      let confidence: 'high' | 'medium' | 'low' = 'low';
      if (hasGoodMatches && hasLegalMatches) {
        confidence = 'high';
      } else if (hasGoodMatches || hasLegalMatches) {
        confidence = 'high';
      } else if (contractChunks.length >= 2 || legalChunks.length >= 1) {
        confidence = 'medium';
      }

      // Format citations
      const formattedCitations = citations.map((c: any) => ({
        kind: 'contract' as const,
        file: c.file || document?.title || 'Document',
        page: c.page || pageNumber,
        spanId: c.spanId || spanId,
        quoteSnippet: c.quoteSnippet || '',
      }));

      const formattedLegalCitations = legalCitations.map((lc: any) => ({
        kind: 'legal' as const,
        source: lc.source || '',
        section: lc.section || '',
        url: lc.url || '',
      }));

      return {
        section: 'Selected Clause',
        originalText: selectedText,
        suggestedText,
        diffBlocks,
        explanation,
        confidence,
        citations: formattedCitations,
        legalCitations: formattedLegalCitations,
        notFound: false,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('Redline generation error:', errorMessage);

      return {
        section: 'Unknown',
        originalText: selectedText,
        suggestedText: selectedText,
        diffBlocks: [],
        explanation: `Error generating redline: ${errorMessage}`,
        confidence: 'low',
        citations: [],
        legalCitations: [],
        notFound: true,
      };
    }
  }

  /**
   * Search for similar contract chunks
   */
  private async searchContractChunks(
    queryEmbedding: number[],
    documentId: string,
    limit: number = 5,
  ): Promise<Array<Chunk & { distance: number }>> {
    const embeddingVector = arrayToVectorString(queryEmbedding);

    const results = await this.chunkRepository.query(
      `
      SELECT 
        c.*,
        1 - (c.embedding::vector <=> $1::vector) AS distance
      FROM chunks c
      WHERE c."documentId" = $2
        AND c.embedding IS NOT NULL
      ORDER BY c.embedding::vector <=> $1::vector
      LIMIT $3
    `,
      [embeddingVector, documentId, limit],
    );

    return results.map((r: any) => ({
      ...r,
      distance: parseFloat(r.distance),
    }));
  }

  /**
   * Search for similar legal source chunks
   */
  private async searchLegalChunks(
    queryEmbedding: number[],
    country?: string,
    jurisdiction?: string,
    limit: number = 5,
  ): Promise<Array<Embedding & { distance: number; sourceName?: string; section?: string; country?: string; jurisdiction?: string; url?: string }>> {
    const embeddingVector = arrayToVectorString(queryEmbedding);

    let query = `
      SELECT 
        e.*,
        ls."sourceName",
        ls."section",
        ls."country",
        ls."jurisdiction",
        ls."url",
        1 - (e.embedding::vector <=> $1::vector) AS distance
      FROM embeddings e
      LEFT JOIN legal_sources ls ON e."legalSourceId" = ls.id
      WHERE e.embedding IS NOT NULL
    `;

    const params: any[] = [embeddingVector];
    let paramIndex = 2;

    if (country) {
      query += ` AND ls.country = $${paramIndex}`;
      params.push(country);
      paramIndex++;
    }

    if (jurisdiction) {
      query += ` AND ls.jurisdiction = $${paramIndex}`;
      params.push(jurisdiction);
      paramIndex++;
    }

    query += ` ORDER BY e.embedding::vector <=> $1::vector LIMIT $${paramIndex}`;
    params.push(limit);

    const results = await this.embeddingRepository.query(query, params);

    return results.map((r: any) => ({
      ...r,
      distance: parseFloat(r.distance),
    }));
  }

  /**
   * Get NOT FOUND message in the specified language
   */
  private getNotFoundMessage(language: string): string {
    const messages: Record<string, string> = {
      'en': 'NOT FOUND: The selected text was not found in the document. Please verify the selection.',
      'es': 'NO ENCONTRADO: El texto seleccionado no se encontró en el documento. Por favor verifique la selección.',
      'pt-BR': 'NÃO ENCONTRADO: O texto selecionado não foi encontrado no documento. Por favor verifique a seleção.',
      'pt': 'NÃO ENCONTRADO: O texto selecionado não foi encontrado no documento. Por favor verifique a seleção.',
      'de': 'NICHT GEFUNDEN: Der ausgewählte Text wurde im Dokument nicht gefunden. Bitte überprüfen Sie die Auswahl.',
    };
    return messages[language] || messages['en'];
  }

  /**
   * Get no citations message in the specified language
   */
  private getNoCitationsMessage(language: string): string {
    const messages: Record<string, string> = {
      'en': 'NOT FOUND: No citations found. The suggested change lacks sufficient evidence.',
      'es': 'NO ENCONTRADO: No se encontraron citas. El cambio sugerido carece de evidencia suficiente.',
      'pt-BR': 'NÃO ENCONTRADO: Nenhuma citação encontrada. A mudança sugerida carece de evidência suficiente.',
      'pt': 'NÃO ENCONTRADO: Nenhuma citação encontrada. A mudança sugerida carece de evidência suficiente.',
      'de': 'NICHT GEFUNDEN: Keine Zitate gefunden. Die vorgeschlagene Änderung hat keine ausreichenden Beweise.',
    };
    return messages[language] || messages['en'];
  }
}
