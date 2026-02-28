/**
 * File-type detection using the file-type package with custom detectors
 * for formats not supported natively (.txt, .md, .doc).
 *
 * Single source of truth for content-based file type detection.
 * Used by: DocumentUploadValidator, asset strategies (avatar, workspace logo),
 * AudioValidationService.
 */

import { Injectable } from '@nestjs/common';
import { fileTypeFromBuffer } from 'file-type';
import { abortAsPromise } from '../common/utils/abort-promise';

/** OLE2 / MS Compound Document magic bytes (legacy .doc) */
const OLE2_MAGIC = new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);

/** Sample size for text/markdown heuristics */
const TEXT_SAMPLE_SIZE = 4096;

/** Printable ASCII + common whitespace */
function isPrintableOrWhitespace(byte: number): boolean {
  return (
    (byte >= 0x20 && byte <= 0x7e) || byte === 0x0a || byte === 0x0d || byte === 0x09
  );
}

/** Markdown heuristic patterns (in first 500 chars) */
const MD_PATTERNS = [
  /^#+\s/m, // # Heading
  /^\s*[-*+]\s/m, // - list item
  /\*\*[^*]+\*\*/, // **bold**
  /\[.+\]\(.+\)/, // [link](url)
];

function detectDocFromBuffer(buffer: Uint8Array): { ext: string; mime: string } | undefined {
  if (buffer.length >= OLE2_MAGIC.length && OLE2_MAGIC.every((b, i) => buffer[i] === b)) {
    return { ext: 'doc', mime: 'application/msword' };
  }
  return undefined;
}

function detectMdFromBuffer(buffer: Uint8Array): { ext: string; mime: string } | undefined {
  if (buffer.length < 4) return undefined;
  if (buffer.some((b) => b === 0)) return undefined;
  let text: string;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(buffer);
  } catch {
    return undefined;
  }
  const printable = buffer.filter(isPrintableOrWhitespace).length;
  if (printable / buffer.length < 0.95) return undefined;
  const sample = text.substring(0, 500);
  const hasMarkdown = MD_PATTERNS.some((re) => re.test(sample));
  if (hasMarkdown) {
    return { ext: 'md', mime: 'text/markdown' };
  }
  return undefined;
}

function detectTxtFromBuffer(buffer: Uint8Array): { ext: string; mime: string } | undefined {
  if (buffer.length < 2) return undefined;
  if (buffer.some((b) => b === 0)) return undefined;
  try {
    new TextDecoder('utf-8', { fatal: true }).decode(buffer);
  } catch {
    return undefined;
  }
  const printable = buffer.filter(isPrintableOrWhitespace).length;
  if (printable / buffer.length >= 0.95) {
    return { ext: 'txt', mime: 'text/plain' };
  }
  return undefined;
}

@Injectable()
export class FileTypeDetectionService {
  /**
   * Detects file type from buffer using magic bytes and custom detectors.
   * Custom detectors run first for .doc, .md, .txt; then file-type for others.
   *
   * @param input - Buffer or Uint8Array
   * @param options - Optional AbortSignal for cancellation
   * @returns { ext, mime } or undefined if not detectable
   */
  async detect(
    input: Buffer | Uint8Array,
    options?: { signal?: AbortSignal },
  ): Promise<{ ext: string; mime: string } | undefined> {
    const buffer = input instanceof Buffer ? new Uint8Array(input) : input;
    const slice = buffer.subarray(0, Math.min(TEXT_SAMPLE_SIZE, buffer.length));

    // Custom detectors (order: doc, md, txt) - run before file-type
    const docResult = detectDocFromBuffer(buffer);
    if (docResult) return docResult;

    const mdResult = detectMdFromBuffer(slice);
    if (mdResult) return mdResult;

    const txtResult = detectTxtFromBuffer(slice);
    if (txtResult) return txtResult;

    // file-type for binary formats (pdf, docx, images, audio, etc.)
    // Use Promise.race for cancellation; file-type may not expose signal in its types
    let detectPromise = fileTypeFromBuffer(buffer);
    if (options?.signal) {
      detectPromise = Promise.race([
        detectPromise,
        abortAsPromise(options.signal),
      ]);
    }
    const result = await detectPromise;
    if (result) {
      return { ext: result.ext, mime: result.mime };
    }

    return undefined;
  }
}
