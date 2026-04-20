import { z } from 'zod';
import {
  ISSUE_CATEGORIES,
  ISSUE_SEVERITIES,
  type LegalAnswer,
} from '@contractai-review/shared';

/**
 * Zod schema for `LegalAnswer`. The provider-side JSON schema sent to
 * OpenAI/Anthropic/xAI is generated from this via `z.toJSONSchema` so the
 * request schema and the validator can never drift apart.
 *
 * Severity / category enums come from `@contractai-review/shared` (single
 * source of truth).
 *
 * IMPORTANT: OpenAI's `json_schema` strict mode requires every property to
 * appear in `required` and disallows `optional`. We model "optional" via
 * `.nullable()` — the LLM may return `null`, which the parser layer then
 * normalises back to `undefined` to match the public `LegalAnswer` interface.
 */
export const LegalIssueWireZ = z.object({
  severity: z.enum(ISSUE_SEVERITIES),
  category: z.enum(ISSUE_CATEGORIES),
  clauseRef: z.string().nullable(),
  message: z.string().min(1),
  legislationRef: z.string().nullable(),
  suggestion: z.string().nullable(),
});

export const LegislationReferenceWireZ = z.object({
  name: z.string().min(1),
  year: z.number().int().nullable(),
  section: z.string().nullable(),
});

export const CompliantElementWireZ = z.object({
  clauseRef: z.string().nullable(),
  rationale: z.string().min(1),
});

/**
 * Wire schema (over-the-wire shape with `null` for missing fields). Use
 * `LegalAnswerZ.parse` and then `normaliseLegalAnswer` to get the final
 * `LegalAnswer` value.
 */
export const LegalAnswerZ = z.object({
  compliantElements: z.array(CompliantElementWireZ),
  issues: z.array(LegalIssueWireZ),
  recommendations: z.array(z.string().min(1)),
  legislationReferenced: z.array(LegislationReferenceWireZ),
  confidence: z.enum(['high', 'medium', 'low']),
  freeText: z.string().max(2000).nullable(),
});

export type LegalAnswerWire = z.infer<typeof LegalAnswerZ>;

/** Convert wire-shape `null`s to the public `LegalAnswer` shape (`undefined`s). */
export function normaliseLegalAnswer(wire: LegalAnswerWire): LegalAnswer {
  return {
    compliantElements: wire.compliantElements.map((c) => ({
      ...(c.clauseRef ? { clauseRef: c.clauseRef } : {}),
      rationale: c.rationale,
    })),
    issues: wire.issues.map((i) => ({
      severity: i.severity,
      category: i.category,
      message: i.message,
      ...(i.clauseRef ? { clauseRef: i.clauseRef } : {}),
      ...(i.legislationRef ? { legislationRef: i.legislationRef } : {}),
      ...(i.suggestion ? { suggestion: i.suggestion } : {}),
    })),
    recommendations: wire.recommendations,
    legislationReferenced: wire.legislationReferenced.map((l) => ({
      name: l.name,
      ...(l.year != null ? { year: l.year } : {}),
      ...(l.section ? { section: l.section } : {}),
    })),
    confidence: wire.confidence,
    ...(wire.freeText ? { freeText: wire.freeText } : {}),
  };
}

/**
 * Walk the generated JSON schema and ensure every object node sets
 * `additionalProperties: false` and lists every property in `required`.
 * Required for OpenAI strict mode; harmless for Anthropic tool-use.
 */
function ensureStrict(node: unknown): unknown {
  if (!node || typeof node !== 'object') return node;
  const obj = node as Record<string, unknown>;
  if (obj.type === 'object') {
    const properties = (obj.properties ?? {}) as Record<string, unknown>;
    obj.additionalProperties = false;
    obj.required = Object.keys(properties);
    for (const key of Object.keys(properties)) {
      ensureStrict(properties[key]);
    }
  }
  if (obj.type === 'array' && obj.items) {
    ensureStrict(obj.items);
  }
  for (const branchKey of ['anyOf', 'oneOf', 'allOf'] as const) {
    const branches = obj[branchKey];
    if (Array.isArray(branches)) {
      for (const b of branches) ensureStrict(b);
    }
  }
  return obj;
}

const _generatedSchema = z.toJSONSchema(LegalAnswerZ, {
  target: 'draft-2020-12',
});

export const LEGAL_ANSWER_SCHEMA_NAME = 'LegalAnswer';

export const LEGAL_ANSWER_JSON_SCHEMA: Record<string, unknown> = ensureStrict(
  JSON.parse(JSON.stringify(_generatedSchema)),
) as Record<string, unknown>;
