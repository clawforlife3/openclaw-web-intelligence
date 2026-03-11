import { describe, expect, it } from 'vitest';
import { detectChallenge, handleChallenge } from '../src/anti-bot/challenge.js';

describe('challenge detection', () => {
  it('detects CAPTCHA pages', () => {
    const result = detectChallenge({
      url: 'https://example.com',
      statusCode: 200,
      headers: {},
      body: '<html>g-recaptcha challenge</html>',
    });

    expect(result.challenged).toBe(true);
    expect(result.type).toBe('captcha');
  });

  it('throws challenge required when unsolved', async () => {
    await expect(handleChallenge({
      url: 'https://example.com',
      statusCode: 403,
      headers: {},
      body: 'verify you are human',
    })).rejects.toMatchObject({ code: 'CHALLENGE_REQUIRED' });
  });
});
