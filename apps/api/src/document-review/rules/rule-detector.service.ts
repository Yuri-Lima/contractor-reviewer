import { Injectable, Logger } from '@nestjs/common';
import type { LegalIssue } from '@contractai-review/shared';
import { RuleLoaderService } from './rule-loader.service';
import type {
  DetectorContext,
  DetectorRuleHit,
  RawRule,
  RawRuleFile,
} from './rule-types';

/**
 * Runs every rule in every loaded YAML file against the document text and
 * returns one `DetectorRuleHit` per match. Cheap: pure regex, no LLM, no
 * embeddings — runs in tens of milliseconds for a contract of any plausible
 * length.
 *
 * Two rule shapes are supported (see rule-types.ts):
 *   - `pattern` rules emit one issue per regex match
 *   - `topicPattern` + `requiredAnyPattern` emit one issue when the topic is
 *     present AND none of the required-any patterns match (statute is
 *     missing).
 */
@Injectable()
export class RuleDetectorService {
  private readonly logger = new Logger(RuleDetectorService.name);

  constructor(private readonly ruleLoader: RuleLoaderService) {}

  detect(ctx: DetectorContext, rulesVersion?: string): DetectorRuleHit[] {
    const ruleFiles = this.ruleLoader.load(rulesVersion);
    if (ruleFiles.length === 0) return [];

    const hits: DetectorRuleHit[] = [];
    for (const file of ruleFiles) {
      if (!this.appliesTo(file, ctx.jurisdiction ?? null)) continue;
      for (const rule of file.rules) {
        try {
          if (rule.pattern) {
            hits.push(...this.runPatternRule(file, rule, ctx));
          } else if (rule.topicPattern && rule.requiredAnyPattern) {
            const hit = this.runMissingStatuteRule(file, rule, ctx);
            if (hit) hits.push(hit);
          } else {
            this.logger.warn(`[rules] ${rule.id}: unsupported rule shape`);
          }
        } catch (err) {
          this.logger.warn(
            `[rules] ${rule.id} threw: ${(err as Error).message}`,
          );
        }
      }
    }
    return hits;
  }

  private appliesTo(file: RawRuleFile, jurisdiction: string | null): boolean {
    if (file.appliesTo === 'any' || !file.appliesTo) return true;
    if (file.appliesTo.startsWith('jurisdiction:')) {
      const target = file.appliesTo.split(':')[1];
      return jurisdiction === target;
    }
    return true;
  }

  private runPatternRule(
    file: RawRuleFile,
    rule: RawRule,
    ctx: DetectorContext,
  ): DetectorRuleHit[] {
    const re = new RegExp(rule.pattern!, rule.flags ?? 'g');
    const hits: DetectorRuleHit[] = [];
    let match: RegExpExecArray | null;
    let safetyBreak = 0;
    while ((match = re.exec(ctx.text)) !== null) {
      // De-dupe identical regex hits at the same offset (regex with /g can
      // loop on zero-width matches; advance manually if so).
      if (match.index === re.lastIndex) re.lastIndex++;
      const clauseRef = this.findClauseRef(ctx, match.index);
      const issue: LegalIssue = {
        severity: rule.severity,
        category: file.category,
        message: rule.message,
        ...(clauseRef ? { clauseRef } : {}),
        ...(rule.remediation ? { suggestion: rule.remediation } : {}),
        ...(rule.legislationReferenced && rule.legislationReferenced.length > 0
          ? {
              legislationRef: this.formatLegislationRef(
                rule.legislationReferenced[0],
              ),
            }
          : {}),
      };
      hits.push({ ruleId: rule.id, rulesVersion: file.rulesVersion, issue });
      if (++safetyBreak > 200) break; // hard cap per rule per doc
      if (!re.global) break;
    }
    return hits;
  }

  private runMissingStatuteRule(
    file: RawRuleFile,
    rule: RawRule,
    ctx: DetectorContext,
  ): DetectorRuleHit | null {
    const topicRe = new RegExp(rule.topicPattern!, 'gi');
    if (!topicRe.test(ctx.text)) return null;
    for (const required of rule.requiredAnyPattern!) {
      const re = new RegExp(required, 'gi');
      if (re.test(ctx.text)) return null;
    }
    const issue: LegalIssue = {
      severity: rule.severity,
      category: file.category,
      message: rule.message,
      ...(rule.remediation ? { suggestion: rule.remediation } : {}),
      ...(rule.legislationReferenced && rule.legislationReferenced.length > 0
        ? {
            legislationRef: this.formatLegislationRef(
              rule.legislationReferenced[0],
            ),
          }
        : {}),
    };
    return { ruleId: rule.id, rulesVersion: file.rulesVersion, issue };
  }

  private formatLegislationRef(ref: {
    actName: string;
    actYear?: number;
    section?: string;
  }): string {
    const parts = [ref.actName];
    if (ref.actYear) parts.push(String(ref.actYear));
    let s = parts.join(' ');
    if (ref.section) s += `, ${ref.section}`;
    return s;
  }

  /**
   * Map a character offset in the concatenated text back to a chunk's
   * clauseNumber, when the chunker recorded one. Falls back to scanning by
   * cumulative length; this is O(n) per match, which is fine because we cap
   * matches at 200 per rule.
   */
  private findClauseRef(
    ctx: DetectorContext,
    offset: number,
  ): string | undefined {
    let cursor = 0;
    for (const chunk of ctx.chunks) {
      const next = cursor + chunk.text.length + 2; // +2 for the "\n\n" join
      if (offset < next) {
        return chunk.clauseNumber ?? undefined;
      }
      cursor = next;
    }
    return undefined;
  }
}
