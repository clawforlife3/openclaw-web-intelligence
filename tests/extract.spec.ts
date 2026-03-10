import { describe, it, expect } from 'vitest';
import { ExtractRequestSchema } from '../src/types/schemas.js';

describe('ExtractRequestSchema', () => {
  it('accepts valid request', () => {
    const parsed = ExtractRequestSchema.parse({ urls: ['https://example.com'] });
    expect(parsed.urls[0]).toBe('https://example.com');
  });
});
