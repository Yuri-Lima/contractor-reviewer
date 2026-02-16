/**
 * Helper to normalize parser errors into user-friendly messages and extract
 * underlying causes for developer logs.
 */

const DOCKER_HINT: Record<string, string> = {
  Docling: "docker-compose up docling",
  PDFPlumber: "docker-compose up pdfplumber",
};

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

function isConnectionError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  const lower = msg.toLowerCase();
  if (lower.includes("fetch failed")) return true;
  if (lower.includes("econnrefused")) return true;
  if (lower.includes("enotfound")) return true;
  if (lower.includes("etimedout")) return true;
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
 * Transform parser errors into user-friendly messages.
 * Detects connection/network failures and returns actionable guidance.
 */
export function toUserFriendlyParserError(
  parserName: string,
  err: unknown,
): string {
  if (isConnectionError(err)) {
    const dockerCmd = DOCKER_HINT[parserName];
    if (dockerCmd) {
      return `${parserName} service is unavailable. Start it with '${dockerCmd}' or try a different parser.`;
    }
    return `${parserName} service is unavailable. Try a different parser.`;
  }
  return `Parser ${parserName} failed. Try a different parser.`;
}
