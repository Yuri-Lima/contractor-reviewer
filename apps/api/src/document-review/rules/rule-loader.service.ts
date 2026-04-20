import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import { parse as parseYaml } from 'yaml';
import type { RawRuleFile } from './rule-types';

const DEFAULT_RULES_VERSION = 'v1';

/**
 * Loads red-flag rule YAML files from `services/red-flag-rules/<version>/`.
 * Caches per (rulesVersion) for the process lifetime — rules are config,
 * not data; bumping rulesVersion is the supported way to roll out changes.
 */
@Injectable()
export class RuleLoaderService {
  private readonly logger = new Logger(RuleLoaderService.name);
  private readonly cache = new Map<string, RawRuleFile[]>();

  constructor(private readonly configService: ConfigService) {}

  getActiveRulesVersion(): string {
    return (
      this.configService.get<string>('RED_FLAG_RULES_VERSION') ??
      DEFAULT_RULES_VERSION
    );
  }

  /**
   * Returns all rule files for a version, or an empty array when the directory
   * doesn't exist (e.g. fresh checkout without the corpus). The detector
   * service treats an empty load as "no rules to run", not as an error.
   */
  load(rulesVersion?: string): RawRuleFile[] {
    const version = rulesVersion ?? this.getActiveRulesVersion();
    const cached = this.cache.get(version);
    if (cached) return cached;

    const dir = path.resolve(
      __dirname,
      '../../../../../services/red-flag-rules',
      version,
    );
    if (!fs.existsSync(dir)) {
      this.logger.warn(`[rules] No rules directory at ${dir}`);
      this.cache.set(version, []);
      return [];
    }

    const files = fs
      .readdirSync(dir)
      .filter((f) => f.endsWith('.yaml') || f.endsWith('.yml'))
      .map((f) => path.join(dir, f));

    const ruleFiles: RawRuleFile[] = [];
    for (const file of files) {
      try {
        const raw = fs.readFileSync(file, 'utf-8');
        const parsed = parseYaml(raw) as RawRuleFile;
        if (!parsed?.rules || !Array.isArray(parsed.rules)) {
          this.logger.warn(`[rules] ${file}: malformed (no rules array)`);
          continue;
        }
        ruleFiles.push(parsed);
      } catch (err) {
        this.logger.warn(
          `[rules] failed to parse ${file}: ${(err as Error).message}`,
        );
      }
    }

    this.cache.set(version, ruleFiles);
    return ruleFiles;
  }
}
