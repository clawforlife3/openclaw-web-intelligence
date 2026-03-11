export interface EvasionConfig {
  // Request pacing
  minDelayMs: number;
  maxDelayMs: number;
  
  // User-Agent
  userAgents: string[];
  rotateUserAgent: boolean;
  
  // Headers
  acceptLanguages: string[];
  extraHeaders: Record<string, string>;
  
  // Browser fingerprint
  randomizeScreen: boolean;
  randomizeTimezone: boolean;
  
  // Session
  sessionTimeout: number;
  
  // Block detection
  blockStatusCodes: number[];
  blockKeywords: string[];
}

const DEFAULT_CONFIG: EvasionConfig = {
  minDelayMs: 3000,
  maxDelayMs: 10000,
  userAgents: [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  ],
  rotateUserAgent: true,
  acceptLanguages: ['en-US,en;q=0.9', 'en-GB,en;q=0.9', 'en;q=0.8'],
  extraHeaders: {
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Encoding': 'gzip, deflate, br',
    'Connection': 'keep-alive',
    'Upgrade-Insecure-Requests': '1',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Sec-Fetch-User': '?1',
  },
  randomizeScreen: true,
  randomizeTimezone: true,
  sessionTimeout: 300000, // 5 minutes
  blockStatusCodes: [403, 429, 503],
  blockKeywords: [
    'captcha',
    'blocked',
    'access denied',
    'forbidden',
    'rate limit',
    'too many requests',
    'cloudflare',
    'challenge',
    'security check',
    'automated requests',
  ],
};

interface Session {
  id: string;
  userAgent: string;
  language: string;
  createdAt: number;
  requestCount: number;
  fingerprint: Record<string, string>;
}

export class EvasionManager {
  private config: EvasionConfig;
  private session: Session | null = null;
  private lastRequestTime = 0;

  constructor(config: Partial<EvasionConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // Request pacing - random delay between requests
  async delay(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    
    const minDelay = this.config.minDelayMs;
    const maxDelay = this.config.maxDelayMs;
    
    // Calculate random delay
    let delay = Math.random() * (maxDelay - minDelay) + minDelay;
    
    // Adjust for time since last request
    delay = Math.max(0, delay - timeSinceLastRequest);
    
    await new Promise((resolve) => setTimeout(resolve, delay));
    this.lastRequestTime = Date.now();
  }

  // Get headers for request
  getHeaders(): Record<string, string> {
    const headers: Record<string, string> = { ...this.config.extraHeaders };

    if (this.config.rotateUserAgent || !this.session) {
      const ua = this.config.userAgents[Math.floor(Math.random() * this.config.userAgents.length)];
      headers['User-Agent'] = ua;
      if (this.session) {
        this.session.userAgent = ua;
      }
    } else if (this.session) {
      headers['User-Agent'] = this.session.userAgent;
    }

    const lang = this.config.acceptLanguages[Math.floor(Math.random() * this.config.acceptLanguages.length)];
    headers['Accept-Language'] = lang;
    if (this.session) {
      this.session.language = lang;
    }

    return headers;
  }

  // Get User-Agent
  getUserAgent(): string {
    return this.config.userAgents[Math.floor(Math.random() * this.config.userAgents.length)];
  }

  // Initialize or get session
  getSession(): Session {
    if (!this.session || Date.now() - this.session.createdAt > this.config.sessionTimeout) {
      this.session = {
        id: `session_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        userAgent: this.getUserAgent(),
        language: this.config.acceptLanguages[0],
        createdAt: Date.now(),
        requestCount: 0,
        fingerprint: this.generateFingerprint(),
      };
    }

    this.session.requestCount++;
    return this.session;
  }

  // Generate browser fingerprint
  generateFingerprint(): Record<string, string> {
    const fp: Record<string, string> = {};

    if (this.config.randomizeScreen) {
      const screens = [
        { width: 1920, height: 1080 },
        { width: 1366, height: 768 },
        { width: 1440, height: 900 },
        { width: 1536, height: 864 },
        { width: 2560, height: 1440 },
      ];
      const screen = screens[Math.floor(Math.random() * screens.length)];
      fp['screen'] = `${screen.width}x${screen.height}`;
      fp['colorDepth'] = '24';
      fp['pixelRatio'] = '1';
    }

    if (this.config.randomizeTimezone) {
      const timezones = ['America/New_York', 'America/Los_Angeles', 'Europe/London', 'Asia/Tokyo', 'UTC'];
      fp['timezone'] = timezones[Math.floor(Math.random() * timezones.length)];
      fp['timezoneOffset'] = String(new Date().getTimezoneOffset());
    }

    fp['platform'] = 'Win32';
    fp['languages'] = 'en-US,en;q=0.9';

    return fp;
  }

  // Detect if response indicates blocking
  detectBlock(statusCode: number, body?: string): boolean {
    // Check status code
    if (this.config.blockStatusCodes.includes(statusCode)) {
      return true;
    }

    // Check body for block keywords
    if (body) {
      const lowerBody = body.toLowerCase();
      for (const keyword of this.config.blockKeywords) {
        if (lowerBody.includes(keyword)) {
          return true;
        }
      }
    }

    return false;
  }

  // Analyze response for blocking signals
  analyzeResponse(statusCode: number, headers: Record<string, string>, body?: string): {
    blocked: boolean;
    reason?: string;
    retryAfter?: number;
  } {
    if (this.detectBlock(statusCode, body)) {
      // Check for Retry-After header
      const retryAfter = headers['retry-after'];
      let retryMs: number | undefined;
      
      if (retryAfter) {
        const seconds = parseInt(retryAfter, 10);
        if (!isNaN(seconds)) {
          retryMs = seconds * 1000;
        }
      }

      return {
        blocked: true,
        reason: `Detected blocking: HTTP ${statusCode}`,
        retryAfter: retryMs,
      };
    }

    return { blocked: false };
  }

  // Get recommended wait time after being blocked
  getBackoffTime(responseHeaders?: Record<string, string>): number {
    const retryAfter = responseHeaders?.['retry-after'];
    
    if (retryAfter) {
      const seconds = parseInt(retryAfter, 10);
      if (!isNaN(seconds)) {
        return seconds * 1000 + 1000; // Add 1 second buffer
      }
    }

    // Default backoff: random between 30s and 2min
    return Math.random() * 90000 + 30000;
  }

  // Reset session
  resetSession(): void {
    this.session = null;
    this.lastRequestTime = 0;
  }

  // Get stats
  getStats(): { sessionId: string | null; requestCount: number; sessionAge: number } {
    return {
      sessionId: this.session?.id || null,
      requestCount: this.session?.requestCount || 0,
      sessionAge: this.session ? Date.now() - this.session.createdAt : 0,
    };
  }
}

let evasionManager: EvasionManager | null = null;

export function createEvasionManager(config?: Partial<EvasionConfig>): EvasionManager {
  evasionManager = new EvasionManager(config);
  return evasionManager;
}

export function getEvasionManager(): EvasionManager | null {
  return evasionManager;
}

export function setEvasionManager(manager: EvasionManager): void {
  evasionManager = manager;
}
