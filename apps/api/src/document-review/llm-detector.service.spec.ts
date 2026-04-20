import type { ConfigService } from '@nestjs/config';
import type { LegalAnswer } from '@contractai-review/shared';
import { LlmDetectorService } from './llm-detector.service';
import type { LlmProviderRegistry } from '../llm/llm-provider.registry';
import type { LegalReviewModelResolver } from '../rag/legal-review-model-resolver.service';
import * as helper from '../rag/structured-output.helper';

/**
 * Unit-tests for the LLM red-flag detector. We mock the
 * `completeStructuredWithRetry` helper so we can drive each window's outcome
 * deterministically and assert on the aggregated result.
 */
describe('LlmDetectorService', () => {
  let service: LlmDetectorService;
  let helperSpy: jest.SpyInstance;
  let providerRegistry: jest.Mocked<LlmProviderRegistry>;
  let modelResolver: jest.Mocked<LegalReviewModelResolver>;

  const buildAnswer = (overrides: Partial<LegalAnswer> = {}): LegalAnswer => ({
    issues: [],
    compliantElements: [],
    recommendations: [],
    legislationReferenced: [],
    confidence: 'medium',
    ...overrides,
  });

  beforeEach(() => {
    providerRegistry = {
      resolveProvider: jest.fn().mockResolvedValue({ name: 'openai' }),
    } as unknown as jest.Mocked<LlmProviderRegistry>;

    modelResolver = {
      resolve: jest.fn().mockReturnValue('gpt-4o'),
    } as unknown as jest.Mocked<LegalReviewModelResolver>;

    const configService = { get: jest.fn() } as unknown as ConfigService;

    service = new LlmDetectorService(
      providerRegistry,
      modelResolver,
      configService,
    );

    helperSpy = jest.spyOn(helper, 'completeStructuredWithRetry');
  });

  afterEach(() => {
    helperSpy.mockRestore();
  });

  it('returns succeeded with merged issues when all windows parse', async () => {
    helperSpy.mockResolvedValueOnce({
      success: true,
      data: buildAnswer({
        issues: [
          {
            severity: 'high',
            category: 'template-artefact',
            message: 'placeholder [XX]',
            clauseRef: '2',
          },
        ],
      }),
      raw: '{}',
      attempts: 1,
    });

    const result = await service.detect('short doc', {
      workspaceId: 'ws1',
      jurisdiction: 'IE',
    });

    expect(result.status).toBe('succeeded');
    expect(result.issues).toHaveLength(1);
    expect(result.modelUsed).toBe('gpt-4o');
    expect(helperSpy).toHaveBeenCalledTimes(1);
  });

  it('marks status as degraded when a window fails but another succeeds', async () => {
    const longText = 'x'.repeat(20_000);
    helperSpy
      .mockResolvedValueOnce({
        success: true,
        data: buildAnswer({
          issues: [
            {
              severity: 'medium',
              category: 'ambiguous',
              message: 'unclear notice period',
            },
          ],
        }),
        raw: '{}',
        attempts: 1,
      })
      .mockResolvedValueOnce({
        success: false,
        data: null,
        raw: 'garbage',
        attempts: 2,
        validationErrors: ['issues: required'],
      });

    const result = await service.detect(longText, { workspaceId: 'ws1' });
    expect(helperSpy).toHaveBeenCalledTimes(2);
    expect(result.status).toBe('degraded');
    expect(result.issues).toHaveLength(1);
    expect(result.errorMessage).toMatch(/structured-output/);
  });

  it('returns failed when every window fails validation', async () => {
    helperSpy.mockResolvedValue({
      success: false,
      data: null,
      raw: '',
      attempts: 2,
    });

    const result = await service.detect('any', { workspaceId: 'ws1' });
    expect(result.status).toBe('failed');
    expect(result.issues).toHaveLength(0);
  });

  it('omits the model override option when modelResolver returns null', async () => {
    modelResolver.resolve.mockReturnValue(undefined);
    helperSpy.mockResolvedValueOnce({
      success: true,
      data: buildAnswer(),
      raw: '{}',
      attempts: 1,
    });

    await service.detect('doc', { workspaceId: 'ws1' });
    const passedOpts = helperSpy.mock.calls[0][4];
    expect(passedOpts.model).toBeUndefined();
    expect(passedOpts.temperature).toBe(0);
  });
});
