import { describe, expect, it } from 'vitest';
import { extract } from '../src/engines/extract/httpExtractor.js';

describe('domain policy', () => {
  it('denies blocked domain', async () => {
    await expect(
      extract({
        urls: ['https://example.com'],
        denyDomains: ['example.com'],
      }),
    ).rejects.toMatchObject({ code: 'DOMAIN_POLICY_DENIED' });
  });
});
