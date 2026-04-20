import { z } from 'zod';
import type {
  ILlmProvider,
  LlmStructuredSchema,
} from '../llm/interfaces/llm-provider.interface';
import { completeStructuredWithRetry } from './structured-output.helper';

const schema: LlmStructuredSchema = {
  name: 'TestPayload',
  jsonSchema: {
    type: 'object',
    additionalProperties: false,
    properties: { name: { type: 'string' }, count: { type: 'number' } },
    required: ['name', 'count'],
  },
};

const Z = z.object({ name: z.string(), count: z.number() });

interface ProviderMock extends ILlmProvider {
  completeStructured: jest.Mock;
}

function buildProvider(): ProviderMock {
  return {
    id: 'openai',
    defaultModel: 'gpt-4o',
    complete: jest.fn(),
    completeStream: jest.fn(),
    completeStructured: jest.fn(),
  } as unknown as ProviderMock;
}

describe('completeStructuredWithRetry', () => {
  it('returns success after a single attempt when validation passes', async () => {
    const provider = buildProvider();
    provider.completeStructured.mockResolvedValueOnce({
      parsed: { name: 'ok', count: 1 },
      raw: '{"name":"ok","count":1}',
    });

    const result = await completeStructuredWithRetry(
      provider,
      [{ role: 'user', content: 'hi' }],
      schema,
      Z,
    );

    expect(result.success).toBe(true);
    expect(result.attempts).toBe(1);
    expect(result.data).toEqual({ name: 'ok', count: 1 });
    expect(provider.completeStructured).toHaveBeenCalledTimes(1);
  });

  it('retries once with a corrective system message that contains the schema name, Zod errors, and truncated raw output', async () => {
    const provider = buildProvider();
    const longRaw = '{' + 'A'.repeat(3000); // > 1500 chars to verify truncation
    provider.completeStructured
      .mockResolvedValueOnce({
        parsed: { name: 'ok' }, // missing `count` -> validation fails
        raw: longRaw,
      })
      .mockResolvedValueOnce({
        parsed: { name: 'ok', count: 7 },
        raw: '{"name":"ok","count":7}',
      });

    const result = await completeStructuredWithRetry(
      provider,
      [
        { role: 'system', content: 'sys' },
        { role: 'user', content: 'hi' },
      ],
      schema,
      Z,
    );

    expect(result.success).toBe(true);
    expect(result.attempts).toBe(2);
    expect(result.data).toEqual({ name: 'ok', count: 7 });

    expect(provider.completeStructured).toHaveBeenCalledTimes(2);
    const retryCall = provider.completeStructured.mock.calls[1];
    const retryMessages = retryCall[0] as Array<{ role: string; content: string }>;
    // Original messages preserved, plus an appended system corrective message.
    expect(retryMessages.length).toBe(3);
    const corrective = retryMessages[retryMessages.length - 1];
    expect(corrective.role).toBe('system');
    expect(corrective.content).toContain('TestPayload');
    expect(corrective.content).toContain('count');
    expect(corrective.content).toContain('truncated to 1500 chars');
    // 1500 chars max from raw + framing copy. Make sure we did not embed the full 3001 chars verbatim.
    expect(corrective.content.length).toBeLessThan(2000);
  });

  it('returns success=false with last raw + validation errors when retry still fails', async () => {
    const provider = buildProvider();
    provider.completeStructured
      .mockResolvedValueOnce({
        parsed: { foo: 'bar' },
        raw: 'first-bad',
      })
      .mockResolvedValueOnce({
        parsed: { name: 'ok' }, // still missing count
        raw: 'second-bad',
      });

    const result = await completeStructuredWithRetry(
      provider,
      [{ role: 'user', content: 'hi' }],
      schema,
      Z,
    );

    expect(result.success).toBe(false);
    expect(result.data).toBeNull();
    expect(result.attempts).toBe(2);
    expect(result.raw).toBe('second-bad');
    expect(result.validationErrors).toBeDefined();
    expect(result.validationErrors!.length).toBeGreaterThan(0);
  });

  it('falls back to the first raw output when the second response has no raw', async () => {
    const provider = buildProvider();
    provider.completeStructured
      .mockResolvedValueOnce({ parsed: { foo: 'bar' }, raw: 'first-raw' })
      .mockResolvedValueOnce({ parsed: { foo: 'still-bad' }, raw: '' });

    const result = await completeStructuredWithRetry(
      provider,
      [{ role: 'user', content: 'hi' }],
      schema,
      Z,
    );

    expect(result.success).toBe(false);
    expect(result.raw).toBe('first-raw');
  });
});
