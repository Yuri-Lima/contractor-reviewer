/**
 * Seeds the legal corpus from YAML files into the `legal_sources` and
 * `embeddings` tables. Phase 3 of the legal-grade RAG pipeline.
 *
 * Usage:
 *   pnpm --filter api exec ts-node --project tsconfig.migration.json \
 *        src/scripts/seed-legal-corpus.ts [--jurisdiction=IE] [--dry-run]
 *
 * Idempotency:
 *   - `legal_sources` rows are upserted on (country, jurisdiction, sourceName).
 *   - `embeddings` rows are upserted on (legalSourceId, section). Stale
 *     embeddings (sections removed from YAML) are deleted.
 *
 * Cost:
 *   ~0.0001 USD per section at text-embedding-3-small list price (1k tokens
 *   per section). The full Irish corpus (~30 sections) costs < 0.01 USD per
 *   re-seed.
 *
 * Staleness: warns when a YAML's `lastVerified` is older than 6 months. Run
 * via `pnpm nx run api:lint-legal-corpus` in CI.
 */

import * as fs from 'fs';
import * as path from 'path';
import { parse as parseYaml } from 'yaml';
import { AppDataSource } from '../data-source';
import { LegalSource, SourceType } from '../entities/legal-source.entity';
import { Embedding } from '../entities/embedding.entity';
import { OpenAI } from 'openai';
import { arrayToVectorString } from '../vector-helpers';

const CORPUS_ROOT = path.resolve(
  __dirname,
  '../../../../services/legal-corpus',
);
const STALENESS_DAYS = 180;

interface CorpusYaml {
  country: string;
  jurisdiction?: string;
  language: string;
  sourceType: SourceType;
  sourceName: string;
  actName?: string;
  actYear?: number;
  url?: string;
  lastVerified: string;
  sections: Array<{ id: string; section: string; text: string }>;
}

interface CliOpts {
  jurisdiction?: string;
  dryRun: boolean;
}

function parseCli(): CliOpts {
  const argv = process.argv.slice(2);
  const opts: CliOpts = { dryRun: false };
  for (const a of argv) {
    if (a === '--dry-run') opts.dryRun = true;
    else if (a.startsWith('--jurisdiction=')) opts.jurisdiction = a.split('=')[1];
  }
  return opts;
}

async function generateEmbedding(client: OpenAI, text: string): Promise<number[]> {
  const res = await client.embeddings.create({
    model: process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small',
    input: text,
  });
  return res.data[0].embedding;
}

function listYamlFiles(jurisdiction?: string): string[] {
  if (!fs.existsSync(CORPUS_ROOT)) return [];
  const dirs = jurisdiction
    ? [path.join(CORPUS_ROOT, jurisdiction)]
    : fs
        .readdirSync(CORPUS_ROOT, { withFileTypes: true })
        .filter((d) => d.isDirectory())
        .map((d) => path.join(CORPUS_ROOT, d.name));
  const files: string[] = [];
  for (const dir of dirs) {
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir)) {
      if (f.endsWith('.yaml') || f.endsWith('.yml')) {
        files.push(path.join(dir, f));
      }
    }
  }
  return files;
}

/**
 * Returns a non-empty warning string when the YAML's `lastVerified` is
 * missing, unparseable, or older than `STALENESS_DAYS`. Returns `null` when
 * the document is fresh. Pure for unit tests.
 */
export function stalenessWarning(
  yamlPath: string,
  doc: Pick<CorpusYaml, 'lastVerified'>,
  now: Date = new Date(),
): string | null {
  if (!doc.lastVerified) return `[corpus] ${yamlPath}: missing lastVerified`;
  const verified = new Date(doc.lastVerified);
  const ageDays = (now.getTime() - verified.getTime()) / (1000 * 60 * 60 * 24);
  if (Number.isNaN(ageDays)) {
    return `[corpus] ${yamlPath}: invalid lastVerified ${doc.lastVerified}`;
  }
  if (ageDays > STALENESS_DAYS) {
    return `[corpus] ${yamlPath}: lastVerified is ${Math.round(ageDays)} days old (> ${STALENESS_DAYS}); please re-verify against source`;
  }
  return null;
}

function checkStaleness(yamlPath: string, doc: CorpusYaml) {
  const w = stalenessWarning(yamlPath, doc);
  if (w) console.warn(w);
}

async function seed() {
  const opts = parseCli();
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey && !opts.dryRun) {
    console.error('OPENAI_API_KEY required (or pass --dry-run)');
    process.exit(1);
  }

  const files = listYamlFiles(opts.jurisdiction);
  if (files.length === 0) {
    console.warn(`[corpus] No YAML files found under ${CORPUS_ROOT}`);
    return;
  }
  console.log(`[corpus] Found ${files.length} corpus file(s)`);

  if (!opts.dryRun) {
    if (!AppDataSource.isInitialized) await AppDataSource.initialize();
  }

  const openai = !opts.dryRun ? new OpenAI({ apiKey }) : null;
  const sourceRepo = !opts.dryRun ? AppDataSource.getRepository(LegalSource) : null;
  const embeddingRepo = !opts.dryRun ? AppDataSource.getRepository(Embedding) : null;

  let totalSections = 0;

  for (const yamlPath of files) {
    const raw = fs.readFileSync(yamlPath, 'utf-8');
    const doc = parseYaml(raw) as CorpusYaml;
    checkStaleness(yamlPath, doc);

    if (opts.dryRun) {
      console.log(
        `[dry] ${doc.sourceName} (${doc.country}/${doc.jurisdiction ?? doc.country}) — ${doc.sections.length} sections`,
      );
      totalSections += doc.sections.length;
      continue;
    }

    let source = await sourceRepo!.findOne({
      where: {
        country: doc.country,
        jurisdiction: doc.jurisdiction ?? doc.country,
        sourceName: doc.sourceName,
      },
    });
    if (!source) {
      source = sourceRepo!.create({
        country: doc.country,
        jurisdiction: doc.jurisdiction ?? doc.country,
        sourceType: doc.sourceType,
        sourceName: doc.sourceName,
        language: doc.language,
        url: doc.url ?? undefined,
        lastUpdated: new Date(doc.lastVerified),
      });
    } else {
      source.url = doc.url ?? source.url;
      source.lastUpdated = new Date(doc.lastVerified);
    }
    await sourceRepo!.save(source);

    const desiredSections = new Set(doc.sections.map((s) => s.section));
    const existing = await embeddingRepo!.find({
      where: { legalSourceId: source.id },
    });
    const stale = existing.filter((e) => !desiredSections.has(e.section));
    if (stale.length) {
      await embeddingRepo!.remove(stale);
      console.log(`[corpus] ${doc.sourceName}: removed ${stale.length} stale section(s)`);
    }

    for (const section of doc.sections) {
      const existingRow = existing.find((e) => e.section === section.section);
      const needsEmbed = !existingRow || existingRow.text !== section.text;
      const embeddingVec = needsEmbed
        ? await generateEmbedding(openai!, `${section.section}\n\n${section.text}`)
        : null;

      const row =
        existingRow ??
        embeddingRepo!.create({
          legalSourceId: source.id,
          text: section.text,
          sourceName: doc.sourceName,
          country: doc.country,
          jurisdiction: doc.jurisdiction ?? doc.country,
          url: doc.url ?? undefined,
          section: section.section,
          embedding: embeddingVec ?? [],
        });
      row.text = section.text;
      row.actName = doc.actName ?? null;
      row.actYear = doc.actYear ?? null;
      row.lastVerified = new Date(doc.lastVerified);
      if (embeddingVec) {
        // Use raw vector string assignment (transformer handles serialisation)
        (row as unknown as { embedding: number[] }).embedding = embeddingVec;
      }
      await embeddingRepo!.save(row);
      totalSections++;
    }
    console.log(
      `[corpus] ${doc.sourceName}: upserted ${doc.sections.length} section(s)`,
    );
  }

  console.log(`[corpus] Done. Total sections processed: ${totalSections}`);
  if (!opts.dryRun) await AppDataSource.destroy();
  // Reference arrayToVectorString to keep the helper imported (used in the
  // raw-SQL path that future Pinecone-style backends would prefer).
  void arrayToVectorString;
}

// Only auto-run when invoked as the entrypoint (skip when imported in tests).
if (require.main === module) {
  seed().catch((err) => {
    console.error('[corpus] Seed failed:', err);
    process.exit(1);
  });
}
