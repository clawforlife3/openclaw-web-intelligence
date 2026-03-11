import { ExtractError } from '../types/errors.js';

export interface ChallengeDetectionResult {
  challenged: boolean;
  type?: 'captcha' | 'js_challenge' | 'bot_check' | 'manual_review';
  reason?: string;
  providerHint?: string;
}

export interface ChallengeSolver {
  name: string;
  solve(input: { url: string; html?: string; headers?: Record<string, string> }): Promise<{ solved: boolean; token?: string; details?: string }>;
}

export function detectChallenge(input: {
  url: string;
  statusCode: number;
  headers: Record<string, string>;
  body?: string;
}): ChallengeDetectionResult {
  const body = input.body?.toLowerCase() || '';
  const headerKeys = Object.keys(input.headers).join(' ').toLowerCase();

  if (body.includes('captcha') || body.includes('g-recaptcha') || body.includes('hcaptcha')) {
    return { challenged: true, type: 'captcha', reason: 'CAPTCHA challenge detected', providerHint: body.includes('hcaptcha') ? 'hcaptcha' : 'recaptcha' };
  }

  if (body.includes('cf-challenge') || body.includes('just a moment') || headerKeys.includes('cf-ray')) {
    return { challenged: true, type: 'js_challenge', reason: 'JavaScript challenge detected', providerHint: 'cloudflare' };
  }

  if (body.includes('security check') || body.includes('verify you are human') || body.includes('automated requests')) {
    return { challenged: true, type: 'bot_check', reason: 'Bot protection page detected' };
  }

  if (input.statusCode === 401 || input.statusCode === 403) {
    return { challenged: true, type: 'manual_review', reason: 'Access requires manual verification' };
  }

  return { challenged: false };
}

export async function handleChallenge(
  input: { url: string; statusCode: number; headers: Record<string, string>; body?: string },
  solver?: ChallengeSolver,
): Promise<void> {
  const detection = detectChallenge(input);
  if (!detection.challenged) return;

  if (solver) {
    const solved = await solver.solve({ url: input.url, html: input.body, headers: input.headers });
    if (solved.solved) return;
  }

  throw new ExtractError('CHALLENGE_REQUIRED', detection.reason || 'Challenge handling required', false, {
    url: input.url,
    challengeType: detection.type,
    providerHint: detection.providerHint,
    nextStep: 'Use manual approval path or integrate a CAPTCHA solver adapter.',
  });
}
