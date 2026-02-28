/**
 * Helper to normalize parser errors into user-friendly messages and extract
 * underlying causes for developer logs.
 */

const DOCKER_HINT: Record<string, string> = {
  Docling: "docker-compose up docling",
  PDFPlumber: "docker-compose up pdfplumber",
};

const CONNECTION_ERROR_CODES = new Set([
  'ECONNREFUSED',
  'ENOTFOUND',
  'ETIMEDOUT',
  'ECONNRESET',
  'ENETUNREACH',
]);

/**
 * Extract underlying cause (err.cause) for dev logs.
 */
export function getUnderlyingCause(err: unknown): string | undefined {
  if (err && typeof err === "object" && "cause" in err) {
    const cause = (err as { cause?: unknown }).cause;
    if (cause instanceof Error) {
      return cause.message || cause.name;
    }
    if (cause && typeof cause === "object" && "code" in cause) {
      return String((cause as { code: string }).code);
    }
  }
  return undefined;
}

function getErrorCode(err: unknown): string | undefined {
  if (err && typeof err === 'object') {
    const cause = (err as { cause?: { code?: string } }).cause;
    if (cause && typeof cause === 'object' && typeof cause.code === 'string') {
      return cause.code;
    }
    const direct = (err as { code?: string }).code;
    if (typeof direct === 'string') return direct;
  }
  return undefined;
}

function isConnectionError(err: unknown): boolean {
  const code = getErrorCode(err);
  if (code && CONNECTION_ERROR_CODES.has(code)) return true;

  const msg = err instanceof Error ? err.message : String(err);
  const lower = msg.toLowerCase();
  if (lower.includes("fetch failed")) return true;
  if (lower.includes("econnrefused")) return true;
  if (lower.includes("enotfound")) return true;
  if (lower.includes("etimedout")) return true;
  if (lower.includes("econnreset")) return true;
  if (lower.includes("network")) return true;

  const cause = getUnderlyingCause(err);
  if (cause) {
    const causeLower = String(cause).toLowerCase();
    if (causeLower.includes("econnrefused")) return true;
    if (causeLower.includes("enotfound")) return true;
    if (causeLower.includes("etimedout")) return true;
  }
  return false;
}

/**
 * Extract HTTP error details from message (e.g. "Docling conversion failed: 500 Internal Server Error - ...")
 */
function extractHttpErrorFromMessage(msg: string): string | undefined {
  const match = msg.match(/(\d{3})\s+([^-]+?)(?:\s+-\s+(.+))?$/);
  if (match) {
    const [, status, statusText, detail] = match;
    const st = statusText.trim();
    const dt = detail?.trim();
    if (dt && dt !== st) return `${status} ${st}: ${dt}`;
    return `${status} ${st}`;
  }
  return undefined;
}

/**
 * Transform parser errors into user-friendly messages.
 * Detects connection/network failures and HTTP errors; surfaces the real failure reason.
 */
export function toUserFriendlyParserError(
  parserName: string,
  err: unknown,
): string {
  const code = getErrorCode(err);
  const codeSuffix = code ? ` (${code})` : '';
  const msg = err instanceof Error ? err.message : String(err);

  if (isConnectionError(err)) {
    const dockerCmd = DOCKER_HINT[parserName];
    if (dockerCmd) {
      return `${parserName} service is unavailable${codeSuffix}. Start it with '${dockerCmd}' or try a different parser.`;
    }
    return `${parserName} service is unavailable${codeSuffix}. Try a different parser.`;
  }

  const httpError = extractHttpErrorFromMessage(msg);
  if (httpError) {
    const dockerLogs = parserName === 'Docling' ? 'docker logs contractai-docling' : parserName === 'PDFPlumber' ? 'docker logs contractai-pdfplumber' : null;
    const hint = dockerLogs ? ` Check logs: ${dockerLogs}. Try a different parser.` : ' Try a different parser.';
    return `${parserName} returned error: ${httpError}.${hint}`;
  }

  return `Parser ${parserName} failed. Try a different parser.`;
}
