import { Injectable } from '@nestjs/common';

export interface JurisdictionResult {
  jurisdiction: string;
  status: 'explicit' | 'inferred' | 'unknown';
  confidence: number;
}

export interface JurisdictionEvidence {
  jurisdiction: string;
  status: 'explicit' | 'inferred';
  confidence: number;
  snippet: string;
  patternType: string;
}

@Injectable()
export class JurisdictionResolverService {
  /**
   * Normalize captured group: trim, collapse multiple spaces to single space.
   */
  private normalizeCapturedGroup(match: string): string {
    return match.trim().replace(/\s+/g, ' ').trim();
  }

  /**
   * Get country/region code by name. Returns null if no mapping found.
   */
  getCountryCodeByName(name: string): string | null {
    const normalized = this.normalizeCapturedGroup(name);
    if (!normalized) return null;

    const countryMap: Record<string, string> = {
      Ireland: 'IE',
      'Republic of Ireland': 'IE',
      'The Republic of Ireland': 'IE',
      England: 'GB',
      'England and Wales': 'GB',
      Wales: 'GB',
      Scotland: 'GB',
      'Northern Ireland': 'GB',
      Germany: 'DE',
      Deutschland: 'DE',
      France: 'FR',
      Spain: 'ES',
      España: 'ES',
      Portugal: 'PT',
      Brazil: 'BR',
      Brasil: 'BR',
      Netherlands: 'NL',
      Holland: 'NL',
      Switzerland: 'CH',
      Suisse: 'CH',
      Schweiz: 'CH',
      Luxembourg: 'LU',
      Singapore: 'SG',
      'Hong Kong': 'HK',
      Australia: 'AU',
    };

    if (countryMap[normalized]) return countryMap[normalized];
    for (const [key, value] of Object.entries(countryMap)) {
      if (key.toLowerCase() === normalized.toLowerCase()) return value;
    }
    return null;
  }

  /**
   * Extract jurisdiction from document text
   */
  async resolveJurisdiction(text: string): Promise<JurisdictionResult> {
    // New explicit patterns (in order) - country/region names in governing law clauses
    const newExplicitPatterns: Array<{ regex: RegExp; patternType: string }> = [
      {
        regex: /governed\s+by\s+and\s+construed\s+in\s+accordance\s+with\s+the\s+laws\s+of\s+([A-Za-z\s]+)/i,
        patternType: 'governed_construed_laws_of',
      },
      {
        regex: /construed\s+in\s+accordance\s+with\s+the\s+laws\s+of\s+([A-Za-z\s]+)/i,
        patternType: 'construed_laws_of',
      },
      {
        regex:
          /laws\s+of\s+(?:the\s+)?(?:Republic\s+of\s+)?(Ireland|England|Scotland|Wales|Northern Ireland|Germany|France|Spain|Portugal|Brazil|Netherlands|Switzerland|Luxembourg|Singapore|Hong Kong|Australia)/i,
        patternType: 'laws_of_country',
      },
      {
        regex: /choice\s+of\s+law[:\s]+([A-Za-z\s\-]+)/i,
        patternType: 'choice_of_law',
      },
      {
        regex: /proper\s+law\s+of\s+([A-Za-z\s]+)/i,
        patternType: 'proper_law_of',
      },
      {
        regex: /exclusive\s+jurisdiction\s+of\s+the\s+courts\s+of\s+([A-Za-z\s]+)/i,
        patternType: 'exclusive_jurisdiction_courts_of',
      },
      {
        regex: /courts\s+of\s+([A-Za-z\s]+)\s+shall\s+have\s+(?:exclusive\s+)?jurisdiction/i,
        patternType: 'courts_shall_have_jurisdiction',
      },
    ];

    for (const { regex, patternType } of newExplicitPatterns) {
      const match = text.match(regex);
      if (match && match[1]) {
        const captured = this.normalizeCapturedGroup(match[1]);
        const countryCode = this.getCountryCodeByName(captured);
        if (countryCode) {
          return { jurisdiction: countryCode, status: 'explicit', confidence: 0.9 };
        }
        const stateCode = this.getStateCodeByName(captured);
        if (stateCode) {
          return { jurisdiction: `US-${stateCode}`, status: 'explicit', confidence: 0.9 };
        }
        if (/^[A-Z]{2}(?:-[A-Z]{2})?$/.test(captured)) {
          return { jurisdiction: captured, status: 'explicit', confidence: 0.9 };
        }
      }
    }

    // Patterns for explicit jurisdiction mentions (including state names)
    const explicitPatterns = [
      /governing\s+law[:\s]+([A-Z]{2}(?:-[A-Z]{2})?)/i,
      /jurisdiction[:\s]+([A-Z]{2}(?:-[A-Z]{2})?)/i,
      /laws\s+of\s+([A-Z]{2}(?:-[A-Z]{2})?)/i,
      /([A-Z]{2}(?:-[A-Z]{2})?)\s+law\s+shall\s+govern/i,
      /under\s+the\s+laws\s+of\s+([A-Z]{2}(?:-[A-Z]{2})?)/i,
      // Patterns for US states by name
      /laws\s+of\s+the\s+State\s+of\s+([A-Z][a-z]+)/i,
      /governed\s+by.*?State\s+of\s+([A-Z][a-z]+)/i,
      /State\s+of\s+([A-Z][a-z]+).*?govern/i,
    ];

    // Check for explicit mentions
    for (const pattern of explicitPatterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        const jurisdiction = match[1];
        // If it's a state name, convert to code
        const stateCode = this.getStateCodeByName(jurisdiction);
        if (stateCode) {
          return {
            jurisdiction: `US-${stateCode}`,
            status: 'explicit',
            confidence: 0.9,
          };
        }
        // If it's already a code format
        if (/^[A-Z]{2}(?:-[A-Z]{2})?$/.test(jurisdiction)) {
          return {
            jurisdiction,
            status: 'explicit',
            confidence: 0.9,
          };
        }
      }
    }

    // Infer from country codes and common patterns
    const countryPatterns = [
      { pattern: /\b(?:United States|USA|US)\b/i, code: 'US' },
      { pattern: /\b(?:Brazil|Brasil|BR)\b/i, code: 'BR' },
      { pattern: /\b(?:United Kingdom|UK|England)\b/i, code: 'GB' },
      { pattern: /\b(?:Canada|CA)\b/i, code: 'CA' },
      { pattern: /\b(?:Germany|Deutschland|DE)\b/i, code: 'DE' },
      { pattern: /\b(?:France|FR)\b/i, code: 'FR' },
      { pattern: /\b(?:Spain|España|ES)\b/i, code: 'ES' },
      { pattern: /\b(?:Portugal|PT)\b/i, code: 'PT' },
    ];

    // Check for country mentions
    for (const { pattern, code } of countryPatterns) {
      if (pattern.test(text)) {
        // Try to infer state/jurisdiction
        const statePatterns = {
          US: [
            /\b(?:California|CA|Cal\.)\b/i,
            /\b(?:New York|NY|N\.Y\.)\b/i,
            /\b(?:Texas|TX|Tex\.)\b/i,
            /\b(?:Florida|FL|Fla\.)\b/i,
            /\b(?:Delaware|DE|Del\.)\b/i,
          ],
          BR: [
            /\b(?:São Paulo|SP)\b/i,
            /\b(?:Rio de Janeiro|RJ)\b/i,
            /\b(?:Minas Gerais|MG)\b/i,
            /\b(?:Distrito Federal|DF)\b/i,
          ],
        };

        const states = statePatterns[code as keyof typeof statePatterns];
        if (states) {
          for (const statePattern of states) {
            const stateMatch = text.match(statePattern);
            if (stateMatch) {
              const stateCode = this.extractStateCode(stateMatch[0], code);
              return {
                jurisdiction: `${code}-${stateCode}`,
                status: 'inferred',
                confidence: 0.7,
              };
            }
          }
        }

        return {
          jurisdiction: code,
          status: 'inferred',
          confidence: 0.6,
        };
      }
    }

    // Infer from currency
    const currencyPatterns = [
      { pattern: /\$|USD|US\s+Dollar/i, code: 'US' },
      { pattern: /R\$|BRL|Real/i, code: 'BR' },
      { pattern: /€|EUR|Euro/i, code: 'EU' },
      { pattern: /£|GBP|Pound/i, code: 'GB' },
    ];

    for (const { pattern, code } of currencyPatterns) {
      if (pattern.test(text)) {
        return {
          jurisdiction: code,
          status: 'inferred',
          confidence: 0.5,
        };
      }
    }

    // Infer from language
    const languagePatterns = [
      { pattern: /\b(?:português|portuguese)\b/i, code: 'BR' },
      { pattern: /\b(?:español|spanish)\b/i, code: 'ES' },
    ];

    for (const { pattern, code } of languagePatterns) {
      if (pattern.test(text)) {
        return {
          jurisdiction: code,
          status: 'inferred',
          confidence: 0.4,
        };
      }
    }

    return {
      jurisdiction: '',
      status: 'unknown',
      confidence: 0,
    };
  }

  /**
   * Extract all jurisdiction evidence from text. Returns all matches with snippet and patternType.
   * Used for evidence aggregation across files.
   */
  extractAllEvidence(text: string): JurisdictionEvidence[] {
    const evidences: JurisdictionEvidence[] = [];
    const snippetMaxLen = 80;

    const addSnippet = (match: RegExpMatchArray, fullText: string): string => {
      const start = Math.max(0, (match.index ?? 0) - 40);
      const end = Math.min(fullText.length, (match.index ?? 0) + match[0].length + 40);
      const snippet = fullText.slice(start, end).replace(/\s+/g, ' ').trim();
      return snippet.length > snippetMaxLen ? snippet.slice(0, snippetMaxLen) + '...' : snippet;
    };

    // New explicit patterns (same order as resolveJurisdiction)
    const newExplicitPatterns: Array<{ regex: RegExp; patternType: string }> = [
      {
        regex: /governed\s+by\s+and\s+construed\s+in\s+accordance\s+with\s+the\s+laws\s+of\s+([A-Za-z\s]+)/gi,
        patternType: 'governed_construed_laws_of',
      },
      {
        regex: /construed\s+in\s+accordance\s+with\s+the\s+laws\s+of\s+([A-Za-z\s]+)/gi,
        patternType: 'construed_laws_of',
      },
      {
        regex:
          /laws\s+of\s+(?:the\s+)?(?:Republic\s+of\s+)?(Ireland|England|Scotland|Wales|Northern Ireland|Germany|France|Spain|Portugal|Brazil|Netherlands|Switzerland|Luxembourg|Singapore|Hong Kong|Australia)/gi,
        patternType: 'laws_of_country',
      },
      {
        regex: /choice\s+of\s+law[:\s]+([A-Za-z\s\-]+)/gi,
        patternType: 'choice_of_law',
      },
      {
        regex: /proper\s+law\s+of\s+([A-Za-z\s]+)/gi,
        patternType: 'proper_law_of',
      },
      {
        regex: /exclusive\s+jurisdiction\s+of\s+the\s+courts\s+of\s+([A-Za-z\s]+)/gi,
        patternType: 'exclusive_jurisdiction_courts_of',
      },
      {
        regex: /courts\s+of\s+([A-Za-z\s]+)\s+shall\s+have\s+(?:exclusive\s+)?jurisdiction/gi,
        patternType: 'courts_shall_have_jurisdiction',
      },
    ];

    for (const { regex, patternType } of newExplicitPatterns) {
      const matches = text.matchAll(regex);
      for (const match of matches) {
        if (match[1]) {
          const captured = this.normalizeCapturedGroup(match[1]);
          let jurisdiction: string | null = this.getCountryCodeByName(captured);
          if (!jurisdiction) jurisdiction = this.getStateCodeByName(captured) ? `US-${this.getStateCodeByName(captured)}` : null;
          if (!jurisdiction && /^[A-Z]{2}(?:-[A-Z]{2})?$/.test(captured)) jurisdiction = captured;
          if (jurisdiction) {
            evidences.push({
              jurisdiction,
              status: 'explicit',
              confidence: 0.9,
              snippet: addSnippet(match, text),
              patternType,
            });
          }
        }
      }
    }

    // Original explicit patterns (ISO codes, US states)
    const explicitPatterns: Array<{ regex: RegExp; patternType: string }> = [
      { regex: /governing\s+law[:\s]+([A-Z]{2}(?:-[A-Z]{2})?)/gi, patternType: 'governing_law_code' },
      { regex: /jurisdiction[:\s]+([A-Z]{2}(?:-[A-Z]{2})?)/gi, patternType: 'jurisdiction_code' },
      { regex: /laws\s+of\s+([A-Z]{2}(?:-[A-Z]{2})?)/gi, patternType: 'laws_of_code' },
      { regex: /([A-Z]{2}(?:-[A-Z]{2})?)\s+law\s+shall\s+govern/gi, patternType: 'law_shall_govern' },
      { regex: /under\s+the\s+laws\s+of\s+([A-Z]{2}(?:-[A-Z]{2})?)/gi, patternType: 'under_laws_of' },
      { regex: /laws\s+of\s+the\s+State\s+of\s+([A-Z][a-z]+)/gi, patternType: 'laws_of_state' },
      { regex: /governed\s+by.*?State\s+of\s+([A-Z][a-z]+)/gi, patternType: 'governed_state' },
      { regex: /State\s+of\s+([A-Z][a-z]+).*?govern/gi, patternType: 'state_govern' },
    ];

    for (const { regex, patternType } of explicitPatterns) {
      const matches = text.matchAll(regex);
      for (const match of matches) {
        if (match[1]) {
          const jurisdiction = match[1];
          const stateCode = this.getStateCodeByName(jurisdiction);
          const code = stateCode ? `US-${stateCode}` : (/^[A-Z]{2}(?:-[A-Z]{2})?$/.test(jurisdiction) ? jurisdiction : null);
          if (code) {
            evidences.push({
              jurisdiction: code,
              status: 'explicit',
              confidence: 0.9,
              snippet: addSnippet(match, text),
              patternType,
            });
          }
        }
      }
    }

    // Inferred: country patterns
    const countryPatterns: Array<{ pattern: RegExp; code: string }> = [
      { pattern: /\b(?:United States|USA|US)\b/gi, code: 'US' },
      { pattern: /\b(?:Brazil|Brasil|BR)\b/gi, code: 'BR' },
      { pattern: /\b(?:United Kingdom|UK|England)\b/gi, code: 'GB' },
      { pattern: /\b(?:Canada|CA)\b/gi, code: 'CA' },
      { pattern: /\b(?:Germany|Deutschland|DE)\b/gi, code: 'DE' },
      { pattern: /\b(?:France|FR)\b/gi, code: 'FR' },
      { pattern: /\b(?:Spain|España|ES)\b/gi, code: 'ES' },
      { pattern: /\b(?:Portugal|PT)\b/gi, code: 'PT' },
    ];

    for (const { pattern, code } of countryPatterns) {
      const matches = text.matchAll(pattern);
      for (const match of matches) {
        evidences.push({
          jurisdiction: code,
          status: 'inferred',
          confidence: 0.6,
          snippet: addSnippet(match, text),
          patternType: 'country_mention',
        });
      }
    }

    // Inferred: currency
    const currencyPatterns: Array<{ pattern: RegExp; code: string }> = [
      { pattern: /\$|USD|US\s+Dollar/gi, code: 'US' },
      { pattern: /R\$|BRL|Real/gi, code: 'BR' },
      { pattern: /€|EUR|Euro/gi, code: 'EU' },
      { pattern: /£|GBP|Pound/gi, code: 'GB' },
    ];

    for (const { pattern, code } of currencyPatterns) {
      const matches = text.matchAll(pattern);
      for (const match of matches) {
        evidences.push({
          jurisdiction: code,
          status: 'inferred',
          confidence: 0.5,
          snippet: addSnippet(match, text),
          patternType: 'currency',
        });
      }
    }

    // Inferred: language
    const languagePatterns: Array<{ pattern: RegExp; code: string }> = [
      { pattern: /\b(?:português|portuguese)\b/gi, code: 'BR' },
      { pattern: /\b(?:español|spanish)\b/gi, code: 'ES' },
    ];

    for (const { pattern, code } of languagePatterns) {
      const matches = text.matchAll(pattern);
      for (const match of matches) {
        evidences.push({
          jurisdiction: code,
          status: 'inferred',
          confidence: 0.4,
          snippet: addSnippet(match, text),
          patternType: 'language',
        });
      }
    }

    return evidences;
  }

  /**
   * Get state code by state name
   */
  private getStateCodeByName(stateName: string): string | null {
    const stateMap: Record<string, string> = {
      California: 'CA',
      'New York': 'NY',
      Texas: 'TX',
      Florida: 'FL',
      Delaware: 'DE',
      CA: 'CA',
      NY: 'NY',
      TX: 'TX',
      FL: 'FL',
      DE: 'DE',
    };

    // Check exact match first
    if (stateMap[stateName]) {
      return stateMap[stateName];
    }

    // Check case-insensitive match
    for (const [key, value] of Object.entries(stateMap)) {
      if (key.toLowerCase() === stateName.toLowerCase()) {
        return value;
      }
    }

    return null;
  }

  /**
   * Extract state code from text
   */
  private extractStateCode(text: string, countryCode: string): string {
    const stateMap: Record<string, Record<string, string>> = {
      US: {
        California: 'CA',
        'New York': 'NY',
        Texas: 'TX',
        Florida: 'FL',
        Delaware: 'DE',
        CA: 'CA',
        NY: 'NY',
        TX: 'TX',
        FL: 'FL',
        DE: 'DE',
      },
      BR: {
        'São Paulo': 'SP',
        'Rio de Janeiro': 'RJ',
        'Minas Gerais': 'MG',
        'Distrito Federal': 'DF',
        SP: 'SP',
        RJ: 'RJ',
        MG: 'MG',
        DF: 'DF',
      },
    };

    const states = stateMap[countryCode];
    if (!states) {
      return '';
    }

    for (const [key, value] of Object.entries(states)) {
      if (text.includes(key)) {
        return value;
      }
    }

    return '';
  }
}
