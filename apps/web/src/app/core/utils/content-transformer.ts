import { marked } from 'marked';

/** OCR page marker pattern: "--- Page N ---" */
const OCR_PAGE_PATTERN = /---\s*Page\s+\d+\s*---/;

/**
 * Detects content format from raw extracted text.
 */
export function detectContentFormat(content: string): 'markdown' | 'ocr' | 'plain' {
  if (!content || content.trim().length === 0) {
    return 'plain';
  }
  const trimmed = content.trim();
  // OCR format: contains "--- Page N ---" pattern
  if (OCR_PAGE_PATTERN.test(content)) {
    return 'ocr';
  }
  // Markdown: common markers in first 500 chars
  const sample = trimmed.substring(0, 500);
  const hasMarkdown =
    /^#+\s/m.test(sample) ||
    /^\s*[-*+]\s/m.test(sample) ||
    /\*\*[^*]+\*\*/.test(sample) ||
    /\[.+\]\(.+\)/.test(sample);
  return hasMarkdown ? 'markdown' : 'plain';
}

/**
 * Transforms raw content to markdown suitable for human-readable rendering.
 * - OCR format: replaces "--- Page N ---" with "## Page N" section headers
 * - Markdown: passes through
 * - Plain text: ensures paragraph breaks (double newlines)
 */
export function toMarkdownForRender(content: string): string {
  if (!content || content.trim().length === 0) {
    return '';
  }
  const format = detectContentFormat(content);
  if (format === 'ocr') {
    return content.replace(/---\s*Page\s+(\d+)\s*---/g, '\n\n## Page $1\n\n');
  }
  if (format === 'plain') {
    // Preserve paragraphs: ensure \n\n between blocks
    return content
      .split(/\n\s*\n/)
      .map((p) => p.trim())
      .filter(Boolean)
      .join('\n\n');
  }
  return content;
}

/**
 * Converts content to safe HTML for display.
 * Uses marked for markdown parsing.
 */
export function contentToHtml(content: string): string {
  const markdown = toMarkdownForRender(content);
  if (!markdown) return '';
  try {
    const html = marked.parse(markdown, { async: false }) as string;
    return html ?? '';
  } catch {
    return escapeHtml(content);
  }
}

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML.replace(/\n/g, '<br>');
}
