import { Injectable } from '@nestjs/common';
import { DiffMatchPatch, DiffOp } from 'diff-match-patch-ts';
import { DiffBlock } from '@contractai-review/shared';

// Re-export for backward compatibility
export type { DiffBlock };

export interface Decision {
  blockId: string;
  decision: 'accept' | 'reject';
}

export interface TextRegionMatch {
  startIndex: number;
  endIndex: number;
  matchScore: number;
  matchedText: string;
  isExactMatch: boolean;
}

@Injectable()
export class DiffService {
  private readonly dmp: DiffMatchPatch;

  constructor() {
    this.dmp = new DiffMatchPatch();
  }

  /**
   * Generate diff blocks from original and suggested text
   */
  generateDiffBlocks(originalText: string, suggestedText: string): DiffBlock[] {
    const diffs = this.dmp.diff_main(originalText, suggestedText);
    this.dmp.diff_cleanupSemantic(diffs);

    const blocks: DiffBlock[] = [];
    let blockIndex = 0;

    for (const diff of diffs) {
      const [operation, text] = diff;

      if (operation === DiffOp.Equal) {
        blocks.push({
          id: `b${blockIndex++}`,
          type: 'equal',
          text,
        });
      } else if (operation === DiffOp.Delete) {
        blocks.push({
          id: `b${blockIndex++}`,
          type: 'remove',
          text,
        });
      } else if (operation === DiffOp.Insert) {
        blocks.push({
          id: `b${blockIndex++}`,
          type: 'add',
          text,
        });
      }
    }

    return blocks;
  }

  /**
   * Apply decisions to reconstruct final text
   */
  applyDecisions(
    originalText: string,
    diffBlocks: DiffBlock[],
    decisions: Decision[],
  ): string {
    const decisionMap = new Map<string, 'accept' | 'reject'>();
    for (const decision of decisions) {
      decisionMap.set(decision.blockId, decision.decision);
    }

    let result = '';
    let originalIndex = 0;

    for (const block of diffBlocks) {
      const decision = decisionMap.get(block.id);

      if (block.type === 'equal') {
        // Always keep equal blocks
        result += block.text;
        originalIndex += block.text.length;
      } else if (block.type === 'remove') {
        // Remove block: accept = remove, reject = keep
        if (decision === 'accept') {
          // Skip this text (remove it)
          originalIndex += block.text.length;
        } else {
          // Keep original text (reject removal)
          result += block.text;
          originalIndex += block.text.length;
        }
      } else if (block.type === 'add') {
        // Add block: accept = add, reject = skip
        if (decision === 'accept') {
          result += block.text;
        }
        // If reject, skip (don't add)
      }
    }

    return result;
  }

  /**
   * Find the position of a text region in the document, with fuzzy matching
   * Returns match information including score and region, or null if not found
   */
  findTextRegion(
    fullDocument: string,
    searchText: string,
    threshold: number = 70,
  ): TextRegionMatch | null {
    // First try exact match
    const exactIndex = fullDocument.indexOf(searchText);
    if (exactIndex !== -1) {
      return {
        startIndex: exactIndex,
        endIndex: exactIndex + searchText.length,
        matchScore: 100,
        matchedText: searchText,
        isExactMatch: true,
      };
    }
    
    // If not found, try to find a similar region (fuzzy match)
    // Split searchText into words and find region with most matching words
    const searchWords = searchText.split(/\s+/).filter(w => w.length > 0);
    if (searchWords.length === 0) {
      return null;
    }
    
    // Find region with at least threshold% word match
    const words = fullDocument.split(/\s+/);
    let bestMatch: { startIndex: number; endIndex: number; score: number; matchedText: string } | null = null;
    let bestScore = 0;
    const thresholdRatio = threshold / 100;
    
    for (let i = 0; i <= words.length - searchWords.length; i++) {
      let matches = 0;
      for (let j = 0; j < searchWords.length && i + j < words.length; j++) {
        const word1 = words[i + j].toLowerCase().replace(/[^\w]/g, '');
        const word2 = searchWords[j].toLowerCase().replace(/[^\w]/g, '');
        if (word1 === word2 || word1.includes(word2) || word2.includes(word1)) {
          matches++;
        }
      }
      const score = matches / searchWords.length;
      if (score > bestScore && score >= thresholdRatio) {
        bestScore = score;
        // Calculate approximate start and end indices
        const textBefore = words.slice(0, i).join(' ');
        const matchedWords = words.slice(i, i + searchWords.length);
        const matchedText = matchedWords.join(' ');
        const startIndex = textBefore.length + (textBefore.length > 0 ? 1 : 0);
        const endIndex = startIndex + matchedText.length;
        
        bestMatch = {
          startIndex,
          endIndex,
          score: Math.round(score * 100),
          matchedText,
        };
      }
    }
    
    if (!bestMatch) {
      return null;
    }
    
    return {
      startIndex: bestMatch.startIndex,
      endIndex: bestMatch.endIndex,
      matchScore: bestMatch.score,
      matchedText: bestMatch.matchedText,
      isExactMatch: false,
    };
  }

  /**
   * Apply redline changes to a specific region in the full document
   * Finds the originalText in the fullDocument and replaces only that region
   * @param explicitRegion Optional explicit region to use directly (from user selection)
   * @param fuzzyThreshold Optional threshold for fuzzy matching (0-100), defaults to 70
   */
  applyChangesToRegion(
    fullDocument: string,
    originalText: string,
    diffBlocks: DiffBlock[],
    decisions: Decision[],
    explicitRegion?: { startIndex: number; endIndex: number },
    fuzzyThreshold?: number,
  ): string {
    // First, apply decisions to get the modified text
    const modifiedText = this.applyDecisions(originalText, diffBlocks, decisions);
    
    // If explicit region provided, use it directly
    if (explicitRegion) {
      const beforeRegion = fullDocument.substring(0, explicitRegion.startIndex);
      const afterRegion = fullDocument.substring(explicitRegion.endIndex);
      return beforeRegion + modifiedText + afterRegion;
    }
    
    // Otherwise, use fuzzy matching to find the region
    const threshold = fuzzyThreshold || 70;
    const match = this.findTextRegion(fullDocument, originalText, threshold);
    
    if (!match) {
      // If not found even with fuzzy matching, return original document
      // This should not happen in normal flow, but we handle it gracefully
      console.warn(`Original text not found in document (even with fuzzy matching at ${threshold}% threshold). Returning original document.`);
      return fullDocument;
    }
    
    // Replace only the specific region
    const beforeRegion = fullDocument.substring(0, match.startIndex);
    const afterRegion = fullDocument.substring(match.endIndex);
    
    return beforeRegion + modifiedText + afterRegion;
  }
}
