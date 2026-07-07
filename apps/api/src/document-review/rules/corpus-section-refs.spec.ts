import * as fs from 'fs';
import * as path from 'path';
import { parse as parseYaml } from 'yaml';
/**
 * Collect every `id:` under sections: in the legal corpus YAML tree.
 */
function loadCorpusSectionIds(corpusRoot: string): Set<string> {
  const ids = new Set<string>();
  if (!fs.existsSync(corpusRoot)) return ids;

  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
        continue;
      }
      if (!entry.name.endsWith('.yaml') && !entry.name.endsWith('.yml')) continue;
      const raw = fs.readFileSync(full, 'utf-8');
      const doc = parseYaml(raw) as {
        sections?: Array<{ id?: string }>;
      };
      for (const section of doc.sections ?? []) {
        if (section.id) ids.add(section.id);
      }
    }
  };
  walk(corpusRoot);
  return ids;
}

interface RuleFileShape {
  rules?: Array<{ id: string; corpusSectionIds?: string[] }>;
}

function loadRuleFiles(rulesDir: string): Array<{ file: string; data: RuleFileShape }> {
  if (!fs.existsSync(rulesDir)) return [];
  return fs
    .readdirSync(rulesDir)
    .filter((f) => f.endsWith('.yaml') || f.endsWith('.yml'))
    .map((f) => {
      const full = path.join(rulesDir, f);
      return {
        file: f,
        data: parseYaml(fs.readFileSync(full, 'utf-8')) as RuleFileShape,
      };
    });
}

describe('red-flag rule corpus section cross-references', () => {
  const repoRoot = path.resolve(__dirname, '../../../../../');
  const corpusRoot = path.join(repoRoot, 'services/legal-corpus');
  const rulesDir = path.join(repoRoot, 'services/red-flag-rules/v1');

  it('every corpusSectionIds entry resolves to a live legal-corpus section id', () => {
    const corpusIds = loadCorpusSectionIds(corpusRoot);
    expect(corpusIds.size).toBeGreaterThan(0);

    const ruleFiles = loadRuleFiles(rulesDir);
    expect(ruleFiles.length).toBeGreaterThan(0);

    const broken: string[] = [];
    let totalRefs = 0;

    for (const { file, data } of ruleFiles) {
      for (const rule of data.rules ?? []) {
        for (const sectionId of rule.corpusSectionIds ?? []) {
          totalRefs += 1;
          if (!corpusIds.has(sectionId)) {
            broken.push(`${file} / ${rule.id} → ${sectionId}`);
          }
        }
      }
    }

    // At least the three historically-broken renames must be covered by live refs
    expect(totalRefs).toBeGreaterThanOrEqual(3);
    expect(broken).toEqual([]);
  });

  it('documents the three renames that previously broke red-flag rules', () => {
    const corpusIds = loadCorpusSectionIds(corpusRoot);
    // Old IDs that existed before the corpus reorg — must NOT be present
    const obsolete = [
      'aerssa-2024-interpretation',
      'aerssa-2024-eligibility',
      'pensions-1990-prsa-access',
    ];
    for (const oldId of obsolete) {
      expect(corpusIds.has(oldId)).toBe(false);
    }
    // Current canonical IDs that replace them
    expect(corpusIds.has('ae-act-2024-s2')).toBe(true);
    expect(corpusIds.has('ae-act-2024-s10-eligibility')).toBe(true);
    expect(corpusIds.has('pensions-act-1990-s121-prsa')).toBe(true);
  });
});
