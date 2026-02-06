import { Injectable } from '@nestjs/common';

export interface JurisdictionResult {
  jurisdiction: string;
  status: 'explicit' | 'inferred' | 'unknown';
  confidence: number;
}

@Injectable()
export class JurisdictionResolverService {
  /**
   * Extract jurisdiction from document text
   */
  async resolveJurisdiction(text: string): Promise<JurisdictionResult> {
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
