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
import {
  RedlineChange,
  RedlinePlaybook,
  ContractCitation,
  LegalCitation,
} from '@contractai-review/shared';
import { DiffService } from './diff.service';
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

    // Build prompt based on playbook
    const playbookPrompt = this.getPlaybookPrompt(playbook);
    const objectiveText = objective ? `\n\nObjective: ${objective}` : '';
    const instructionsText = instructions ? `\n\nAdditional Instructions: ${instructions}` : '';
    
    const languageName = this.getLanguageName(language);

    const prompt = `You are a legal assistant helping to revise contract clauses. Your task is to suggest improvements to the selected text while maintaining legal accuracy and professional tone.

IMPORTANT: You MUST provide all responses, especially the "explanation" field, in ${languageName}. All explanations, suggestions, and comments must be written in ${languageName}.

${playbookPrompt}

Selected Text to Revise:
"${selectedText}"

Context from Contract and Legal Sources:
${context || 'No additional context available.'}
${objectiveText}${instructionsText}

IMPORTANT RULES:
- NEVER say "this is illegal", "you must", or "you should"
- ALWAYS use conditional language ("may", "could", "depending on", "consider")
- NEVER provide legal advice or make absolute statements
- ALWAYS cite specific excerpts from the contract or legal sources
- If you cannot find sufficient evidence, respond with "NOT FOUND" and explain what was searched
- RESPOND IN ${languageName.toUpperCase()}: All explanations must be in ${languageName}

Please provide:
1. A revised version of the selected text (suggestedText) - keep original language of the contract
2. A clear explanation of why the change was suggested (explanation) - MUST be in ${languageName}
3. Specific citations from the contract (citations)
4. Legal citations if relevant (legalCitations)

Format your response as JSON:
{
  "suggestedText": "...",
  "explanation": "...",
  "citations": [
    {
      "kind": "contract",
      "file": "...",
      "page": 12,
      "spanId": "...",
      "quoteSnippet": "..."
    }
  ],
  "legalCitations": [
    {
      "kind": "legal",
      "source": "...",
      "section": "...",
      "url": "..."
    }
  ]
}`;

    try {
      const response = await this.openaiClient.chat.completions.create({
        model: this.chatModel,
        messages: [
          {
            role: 'system',
            content:
              'You are a legal assistant. Provide structured, evidence-based contract revisions. Always use conditional language and cite sources. Never provide legal advice. IMPORTANT: When a language is specified, provide all explanations in that language.',
          },
          {
            role: 'user',
            content: prompt,
          },
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
   * Map language codes to language names
   */
  private getLanguageName(languageCode: string): string {
    const languageMap: Record<string, string> = {
      'en': 'English',
      'es': 'Spanish',
      'pt-BR': 'Portuguese (Brazil)',
      'pt': 'Portuguese',
      'de': 'German',
    };
    return languageMap[languageCode] || 'English';
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

  /**
   * Get playbook-specific prompt
   */
  private getPlaybookPrompt(playbook: RedlinePlaybook): string {
    switch (playbook) {
      case RedlinePlaybook.CONSERVATIVE:
        return `Playbook: CONSERVATIVE
- Minimize changes to the original text
- Focus on clarity and precision
- Use neutral, professional language
- Only suggest changes that improve clarity without changing meaning
- Avoid favoritism toward any party`;

      case RedlinePlaybook.CLIENT_FRIENDLY:
        return `Playbook: CLIENT_FRIENDLY
- Suggest changes that are more favorable to the client/user
- However, remain professional and defensible
- Avoid extreme language or absolute guarantees
- Ensure suggestions are plausible and reasonable
- Balance client interests with legal soundness`;

      case RedlinePlaybook.BALANCED:
      default:
        return `Playbook: BALANCED
- Balance risks and benefits for all parties
- Use neutral, professional language
- Suggest improvements that enhance clarity and fairness
- Consider both parties' interests equally`;
    }
  }
}
