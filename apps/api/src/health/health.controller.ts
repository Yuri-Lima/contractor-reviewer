import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const HEALTH_TIMEOUT_MS = 3000;

interface ParserStatus {
  ok: boolean;
  url: string;
  error?: string;
}

@Controller('health')
export class HealthController {
  constructor(private configService: ConfigService) {}

  @Get('parsers')
  async parsers(): Promise<{
    docling: ParserStatus;
    pdfplumber: ParserStatus;
  }> {
    const doclingUrl =
      this.configService.get<string>('DOCLING_URL') || 'http://localhost:8000';
    const pdfplumberUrl =
      this.configService.get<string>('PDFPLUMBER_URL') ||
      'http://localhost:8001';

    const [docling, pdfplumber] = await Promise.all([
      this.checkParser('docling', doclingUrl, '/health'),
      this.checkParser('pdfplumber', pdfplumberUrl, '/health'),
    ]);

    return { docling, pdfplumber };
  }

  private async checkParser(
    name: string,
    baseUrl: string,
    path: string,
  ): Promise<ParserStatus> {
    const url = `${baseUrl.replace(/\/$/, '')}${path}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), HEALTH_TIMEOUT_MS);

    try {
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);
      return {
        ok: res.ok,
        url: baseUrl,
        ...(res.ok ? {} : { error: `${res.status} ${res.statusText}` }),
      };
    } catch (err) {
      clearTimeout(timeoutId);
      const message = err instanceof Error ? err.message : String(err);
      const causeCode =
        err &&
        typeof err === 'object' &&
        'cause' in err &&
        (err as { cause?: { code?: string } }).cause?.code
          ? (err as { cause: { code: string } }).cause.code
          : undefined;
      return {
        ok: false,
        url: baseUrl,
        error: causeCode ? `${causeCode}: ${message}` : message,
      };
    }
  }
}
