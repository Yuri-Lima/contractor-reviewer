import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Document } from '../entities/document.entity';
import { DocumentFile } from '../entities/document-file.entity';
import { FileStatus } from '@contractai-review/shared';
import { JurisdictionResolverService, JurisdictionEvidence } from './jurisdiction-resolver.service';
import { LlmProviderRegistry } from '../llm/llm-provider.registry';

/** Candidate jurisdiction with evidence for user override */
export interface JurisdictionCandidate {
  jurisdiction: string;
  status: 'explicit' | 'inferred';
  confidence: number;
  evidenceCount: number;
  fileNames: string[];
  snippets: string[];
}

/** Result of jurisdiction evaluation from all files */
export interface JurisdictionEvaluationResult {
  resolvedJurisdiction: string;
  jurisdictionStatus: 'explicit' | 'inferred' | 'unknown';
  jurisdictionCandidates: JurisdictionCandidate[];
  jurisdictionReasoning?: string;
  confidence: number;
}

const JURISDICTION_LLM_TIMEOUT_MS = 30000;

@Injectable()
export class JurisdictionEvaluationService {
  private readonly logger = new Logger(JurisdictionEvaluationService.name);

  constructor(
    @InjectRepository(Document)
    private documentRepository: Repository<Document>,
    @InjectRepository(DocumentFile)
    private documentFileRepository: Repository<DocumentFile>,
    private jurisdictionResolver: JurisdictionResolverService,
    private llmProviderRegistry: LlmProviderRegistry,
  ) {}

  /**
   * Evaluate jurisdiction from all available files. Aggregates evidence, calls LLM for final decision,
   * falls back to rule-based if LLM fails.
   */
  async evaluateFromAllFiles(
    documentId: string,
    workspaceId?: string,
    options?: { signal?: AbortSignal },
  ): Promise<JurisdictionEvaluationResult> {
    const files = await this.documentFileRepository.find({
      where: { documentId, status: FileStatus.AVAILABLE },
      order: { createdAt: 'ASC' },
    });

    const filesWithText = files.filter((f) => f.ocrText && f.ocrText.trim().length > 0);

    if (filesWithText.length === 0) {
      this.logger.log(`[Jurisdiction] evaluateFromAllFiles: no files with ocrText, documentId=${documentId}`);
      return {
        resolvedJurisdiction: '',
        jurisdictionStatus: 'unknown',
        jurisdictionCandidates: [],
        confidence: 0,
      };
    }

    const evidencesByFile: Array<{ fileId: string; fileName: string; fileOrder: number; evidences: JurisdictionEvidence[] }> = [];

    for (let i = 0; i < filesWithText.length; i++) {
      const file = filesWithText[i];
      const evidences = this.jurisdictionResolver.extractAllEvidence(file.ocrText ?? '');
      evidencesByFile.push({
        fileId: file.id,
        fileName: file.fileName,
        fileOrder: i + 1,
        evidences,
      });
    }

    const allEvidences = evidencesByFile.flatMap((f) =>
      f.evidences.map((e) => ({ ...e, fileId: f.fileId, fileName: f.fileName })),
    );

    const candidateMap = new Map<
      string,
      { status: 'explicit' | 'inferred'; confidence: number; fileNames: Set<string>; snippets: string[] }
    >();

    for (const e of allEvidences) {
      const existing = candidateMap.get(e.jurisdiction);
      if (existing) {
        existing.fileNames.add(e.fileName);
        existing.snippets.push(e.snippet);
        if (e.status === 'explicit') {
          existing.status = 'explicit';
          existing.confidence = Math.max(existing.confidence, e.confidence);
        }
      } else {
        candidateMap.set(e.jurisdiction, {
          status: e.status,
          confidence: e.confidence,
          fileNames: new Set([e.fileName]),
          snippets: [e.snippet],
        });
      }
    }

    const jurisdictionCandidates: JurisdictionCandidate[] = Array.from(candidateMap.entries()).map(
      ([jurisdiction, data]) => ({
        jurisdiction,
        status: data.status,
        confidence: data.confidence,
        evidenceCount: data.snippets.length,
        fileNames: Array.from(data.fileNames),
        snippets: data.snippets.slice(0, 5),
      }),
    );

    const evidenceSummary = this.buildEvidenceSummary(evidencesByFile);

    let resolvedJurisdiction = '';
    let jurisdictionStatus: 'explicit' | 'inferred' | 'unknown' = 'unknown';
    let jurisdictionReasoning: string | undefined;
    let confidence = 0;

    if (jurisdictionCandidates.length > 0) {
      try {
        const llmResult = await this.callLlmForJurisdiction(
          evidenceSummary,
          jurisdictionCandidates,
          workspaceId,
          options?.signal,
        );
        if (llmResult) {
          resolvedJurisdiction = llmResult.jurisdiction;
          jurisdictionStatus = llmResult.status;
          jurisdictionReasoning = llmResult.reasoning;
          confidence = llmResult.confidence;
        }
      } catch (err) {
        this.logger.warn(
          `[Jurisdiction] LLM call failed, using fallback: documentId=${documentId}`,
          err instanceof Error ? err.message : String(err),
        );
      }

      if (!resolvedJurisdiction) {
        const fallback = this.ruleBasedFallback(jurisdictionCandidates);
        resolvedJurisdiction = fallback.jurisdiction;
        jurisdictionStatus = fallback.status;
        confidence = fallback.confidence;
      }
    }

    this.logger.log(
      `[Jurisdiction] evaluateFromAllFiles: documentId=${documentId} fileCount=${filesWithText.length} candidateCount=${jurisdictionCandidates.length} resolved=${resolvedJurisdiction}`,
    );

    return {
      resolvedJurisdiction,
      jurisdictionStatus,
      jurisdictionCandidates,
      jurisdictionReasoning,
      confidence,
    };
  }

  private buildEvidenceSummary(
    evidencesByFile: Array<{ fileId: string; fileName: string; fileOrder: number; evidences: JurisdictionEvidence[] }>,
  ): string {
    const lines: string[] = [];
    for (const { fileName, fileOrder, evidences } of evidencesByFile) {
      if (evidences.length === 0) continue;
      const parts = evidences.map(
        (e) => `${e.jurisdiction} (${e.status}, conf=${e.confidence}): "${e.snippet.substring(0, 60)}..."`,
      );
      lines.push(`File ${fileOrder} (${fileName}): ${parts.join('; ')}`);
    }
    return lines.join('\n');
  }

  private async callLlmForJurisdiction(
    evidenceSummary: string,
    candidates: JurisdictionCandidate[],
    workspaceId?: string,
    signal?: AbortSignal,
  ): Promise<{ jurisdiction: string; status: 'explicit' | 'inferred' | 'unknown'; confidence: number; reasoning?: string } | null> {
    const provider = await this.llmProviderRegistry.resolveProvider(workspaceId);

    const systemPrompt = `You are a legal assistant. Determine the governing jurisdiction from contract evidence.
Rules: explicit governing law clauses override inferred signals; frequency and consistency matter; conflicts favor most explicit/specific mention.
Respond with valid JSON only: {"jurisdiction":"CODE or empty","status":"explicit|inferred|unknown","confidence":0.0-1.0,"reasoning":"brief explanation"}`;

    const userPrompt = `Evidence from contract files:\n${evidenceSummary}\n\nCandidates: ${candidates.map((c) => `${c.jurisdiction} (${c.evidenceCount} mentions)`).join(', ')}\n\nWhat is the governing jurisdiction?`;

    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Jurisdiction LLM timeout')), JURISDICTION_LLM_TIMEOUT_MS),
    );

    try {
      const response = await Promise.race([
        provider.complete(
          [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          { ...(signal ? { signal } : {}), maxTokens: 300, temperature: 0 },
        ),
        timeoutPromise,
      ]);

      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return null;

      const parsed = JSON.parse(jsonMatch[0]) as {
        jurisdiction?: string;
        status?: string;
        confidence?: number;
        reasoning?: string;
      };

      const jurisdiction = typeof parsed.jurisdiction === 'string' ? parsed.jurisdiction.trim() : '';
      const status =
        parsed.status === 'explicit' || parsed.status === 'inferred' || parsed.status === 'unknown'
          ? parsed.status
          : 'unknown';
      const confidence = typeof parsed.confidence === 'number' ? Math.max(0, Math.min(1, parsed.confidence)) : 0.5;

      return { jurisdiction, status, confidence, reasoning: parsed.reasoning };
    } catch {
      return null;
    }
  }

  private ruleBasedFallback(
    candidates: JurisdictionCandidate[],
  ): { jurisdiction: string; status: 'explicit' | 'inferred'; confidence: number } {
    const explicit = candidates.filter((c) => c.status === 'explicit');
    const toUse = explicit.length > 0 ? explicit : candidates;
    const sorted = [...toUse].sort((a, b) => {
      if (a.confidence !== b.confidence) return b.confidence - a.confidence;
      return b.evidenceCount - a.evidenceCount;
    });
    const best = sorted[0];
    return {
      jurisdiction: best.jurisdiction,
      status: best.status,
      confidence: best.confidence,
    };
  }
}
