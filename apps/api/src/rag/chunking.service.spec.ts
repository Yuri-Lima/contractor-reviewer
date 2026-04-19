import { ChunkingService } from './chunking.service';

describe('ChunkingService', () => {
  let service: ChunkingService;

  beforeEach(() => {
    service = new ChunkingService();
  });

  describe('chunkByParagraph (default strategy)', () => {
    it('returns an empty array for empty input', () => {
      expect(service.chunkText('')).toEqual([]);
    });

    it('returns an empty array for whitespace-only input', () => {
      expect(service.chunkText('   \n\n   \t  \n')).toEqual([]);
    });

    it('splits on blank lines (regression)', () => {
      const text = 'First paragraph here.\n\nSecond paragraph here.';
      const chunks = service.chunkText(text);
      expect(chunks).toHaveLength(1);
      expect(chunks[0].text).toContain('First paragraph here.');
      expect(chunks[0].text).toContain('Second paragraph here.');
      expect(chunks[0].text).toContain('\n\n');
    });

    it('handles CRLF line endings (regression)', () => {
      const text = 'Line one paragraph.\r\n\r\nLine two paragraph.';
      const chunks = service.chunkText(text);
      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks[0].text).toContain('Line one paragraph.');
      expect(chunks[0].text).toContain('Line two paragraph.');
      expect(chunks[0].text).not.toContain('\r');
    });

    it('detects single-newline paragraphs in long plain text', () => {
      const sentence =
        'The contractor shall deliver the goods on time and in good condition without exception.';
      const text = Array.from({ length: 12 }, () => sentence).join('\n');

      const chunks = service.chunkText(text);
      expect(chunks.length).toBeGreaterThan(0);
      const allText = chunks.map((c) => c.text).join('\n\n');
      expect(allText).toContain(sentence);
    });

    it('detects indentation-based paragraph breaks', () => {
      const longLeading =
        'This is the leading clause that is fairly long so the heuristic kicks in and considers indentation transitions as paragraph boundaries between adjacent lines of text.';
      const longIndented =
        '    Indented sub-clause content that should be recognized as a separate logical paragraph due to the indentation change between adjacent lines without a blank separator.';
      const text = `${longLeading}\n${longIndented}`;

      const chunks = service.chunkText(text);
      expect(chunks.length).toBeGreaterThan(0);
      const combined = chunks.map((c) => c.text).join('\n\n');
      expect(combined).toContain('leading clause');
      expect(combined).toContain('Indented sub-clause');
    });

    it('falls back to sentence chunking when no paragraphs are usable', () => {
      const text = 'Just one short sentence.';
      const chunks = service.chunkText(text);
      expect(chunks).toHaveLength(1);
      expect(chunks[0].text).toBe('Just one short sentence.');
    });
  });

  describe('Markdown awareness', () => {
    it('treats headings as separate paragraphs', () => {
      const text = '# Title One\n\nBody of the first section.\n\n# Title Two\n\nBody of the second section.';
      const chunks = service.chunkText(text);
      const combined = chunks.map((c) => c.text).join('\n\n');
      expect(combined).toContain('# Title One');
      expect(combined).toContain('# Title Two');
      expect(combined).toContain('Body of the first section.');
      expect(combined).toContain('Body of the second section.');
    });

    it('expands list items into separate paragraphs even without blank lines between them', () => {
      const longItems = Array.from(
        { length: 30 },
        (_, i) =>
          `- Item ${i + 1}: clause about responsibilities and obligations of the contracting parties.`,
      ).join('\n');

      const chunks = service.chunkText(longItems);
      expect(chunks.length).toBeGreaterThan(1);

      const allText = chunks.map((c) => c.text).join('\n');
      for (let i = 1; i <= 30; i++) {
        expect(allText).toContain(`Item ${i}:`);
      }
    });

    it('keeps fenced code blocks intact even when they exceed CHUNK_SIZE', () => {
      const codeBody = Array.from(
        { length: 80 },
        (_, i) => `console.log("line ${i}");`,
      ).join('\n');
      const text = `Intro paragraph.\n\n\`\`\`ts\n${codeBody}\n\`\`\`\n\nClosing paragraph.`;

      const chunks = service.chunkText(text);
      expect(chunks.length).toBeGreaterThan(0);

      const fencedChunk = chunks.find((c) => c.text.includes('```'));
      expect(fencedChunk).toBeDefined();
    });

    it('preserves table rows together', () => {
      const text =
        '# Header\n\n| Col A | Col B |\n|-------|-------|\n| 1 | 2 |\n| 3 | 4 |\n\nFollow-up paragraph.';
      const chunks = service.chunkText(text);
      const combined = chunks.map((c) => c.text).join('\n\n');
      expect(combined).toContain('| Col A | Col B |');
      expect(combined).toContain('| 1 | 2 |');
      expect(combined).toContain('| 3 | 4 |');
    });
  });

  describe('chunkBySentences', () => {
    it('splits text on sentence boundaries', () => {
      const text = 'First sentence. Second sentence! Third sentence?';
      const chunks = service.chunkText(text, undefined, 'sentence');
      expect(chunks).toHaveLength(1);
      expect(chunks[0].text).toContain('First sentence.');
    });
  });

  describe('chunkByFixedSize', () => {
    it('splits long text into fixed-size chunks with overlap', () => {
      const text = 'a'.repeat(2500);
      const chunks = service.chunkText(text, undefined, 'fixed_size');
      expect(chunks.length).toBeGreaterThan(1);
      for (const chunk of chunks) {
        expect(chunk.text.length).toBeLessThanOrEqual(1000);
      }
    });
  });

  describe('chunkPages', () => {
    it('chunks each page and tags the page number', () => {
      const pages = [
        { pageNumber: 1, text: 'Page one paragraph.\n\nSecond paragraph on page one.' },
        { pageNumber: 2, text: 'Page two content.' },
      ];
      const chunks = service.chunkPages(pages);
      expect(chunks.length).toBeGreaterThanOrEqual(2);
      expect(chunks.some((c) => c.pageNumber === 1)).toBe(true);
      expect(chunks.some((c) => c.pageNumber === 2)).toBe(true);
    });
  });
});
