import { ProxyAgent } from 'undici';

export interface Proxy {
  id: string;
  url: string;
  health: number;
  successCount: number;
  failCount: number;
  lastChecked: Date | null;
  latency: number;
  isHealthy: boolean;
}

export interface ProxyPoolConfig {
  proxies?: string[];
  healthCheckInterval?: number;
  minHealthThreshold?: number;
  strategy?: 'random' | 'round-robin' | 'least-used';
  healthCheckUrl?: string;
}

const DEFAULT_CONFIG: Required<ProxyPoolConfig> = {
  proxies: [],
  healthCheckInterval: 60000,
  minHealthThreshold: 0.3,
  strategy: 'round-robin',
  healthCheckUrl: 'https://httpbin.org/ip',
};

let pool: ProxyPool | null = null;

function generateProxyId(): string {
  return `proxy_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export class ProxyPool {
  private proxies: Map<string, Proxy> = new Map();
  private roundRobinIndex = 0;
  private healthCheckTimer: NodeJS.Timeout | null = null;
  private config: Required<ProxyPoolConfig>;

  constructor(userConfig: ProxyPoolConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...userConfig };

    if (this.config.proxies) {
      for (const url of this.config.proxies) {
        this.addProxy(url);
      }
    }
  }

  addProxy(url: string): Proxy {
    const id = generateProxyId();
    const proxy: Proxy = {
      id,
      url,
      health: 1,
      successCount: 0,
      failCount: 0,
      lastChecked: null,
      latency: 0,
      isHealthy: true,
    };
    this.proxies.set(id, proxy);
    return proxy;
  }

  removeProxy(id: string): boolean {
    return this.proxies.delete(id);
  }

  getProxy(): Proxy | null {
    const healthy = Array.from(this.proxies.values()).filter(p => p.isHealthy);
    if (healthy.length === 0) return null;

    switch (this.config.strategy) {
      case 'random':
        return healthy[Math.floor(Math.random() * healthy.length)];
      case 'least-used':
        return healthy.sort((a, b) => a.successCount - b.successCount)[0];
      case 'round-robin':
      default: {
        const proxy = healthy[this.roundRobinIndex % healthy.length];
        this.roundRobinIndex++;
        return proxy;
      }
    }
  }

  reportResult(proxyId: string, success: boolean, latencyMs: number): void {
    const proxy = this.proxies.get(proxyId);
    if (!proxy) return;

    if (success) {
      proxy.successCount++;
      proxy.latency = proxy.latency * 0.9 + latencyMs * 0.1;
    } else {
      proxy.failCount++;
    }

    const total = proxy.successCount + proxy.failCount;
    proxy.health = total > 10 ? proxy.successCount / total : proxy.health;
    proxy.isHealthy = proxy.health >= this.config.minHealthThreshold;
    proxy.lastChecked = new Date();
  }

  async healthCheck(): Promise<void> {
    const proxies = Array.from(this.proxies.values());
    
    for (const proxy of proxies) {
      try {
        const start = Date.now();
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);

        const response = await fetch(this.config.healthCheckUrl, {
          // @ts-expect-error - dispatcher is undici-specific
          dispatcher: new ProxyAgent(proxy.url),
          signal: controller.signal,
        });

        clearTimeout(timeout);
        
        if (response.ok) {
          this.reportResult(proxy.id, true, Date.now() - start);
        } else {
          this.reportResult(proxy.id, false, Date.now() - start);
        }
      } catch {
        this.reportResult(proxy.id, false, 5000);
      }
    }
  }

  startHealthCheck(): void {
    if (this.healthCheckTimer) return;
    this.healthCheckTimer = setInterval(
      () => void this.healthCheck(),
      this.config.healthCheckInterval
    );
  }

  stopHealthCheck(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
    }
  }

  getStats(): { total: number; healthy: number; unhealthy: number } {
    const all = Array.from(this.proxies.values());
    return {
      total: all.length,
      healthy: all.filter(p => p.isHealthy).length,
      unhealthy: all.filter(p => !p.isHealthy).length,
    };
  }

  listProxies(): Proxy[] {
    return Array.from(this.proxies.values());
  }
}

export function createProxyPool(userConfig: ProxyPoolConfig = {}): ProxyPool {
  pool = new ProxyPool(userConfig);
  return pool;
}

export function getProxyPool(): ProxyPool | null {
  return pool;
}

export function setProxyPool(newPool: ProxyPool): void {
  pool = newPool;
}
