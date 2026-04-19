/**
 * Normalizes malformed citation patterns in LLM markdown output.
 * The LLM may output [Document Excerpt N][document excerpt n] (reference-style link without definition),
 * which does not render. Replace with **Document Excerpt N** (bold) for proper display.
 */
export function normalizeCitationMarkdown(text: string): string {
  if (!text || typeof text !== 'string') return text;
  return text
    .replace(
      /\[Document Excerpt (\d+)\]\[document excerpt \d+\]/gi,
      '**Document Excerpt $1**',
    )
    .replace(
      /\[Legal Source (\d+)\]\[legal source \d+\]/gi,
      '**Legal Source $1**',
    );
}
