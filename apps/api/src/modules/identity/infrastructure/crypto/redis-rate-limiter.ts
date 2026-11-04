// Rate-limit distribuido en Redis, ventana fija atómica (Lua).
// I1: se activa con REDIS_URL. Ante fallo de Redis: fail-open con aviso
// (el rate-limit mitiga abuso, no autoriza; la disponibilidad manda).
import { RateLimiter, RateLimitResult } from '../../application/ports';

/** Superficie mínima de ioredis que usamos (inyectable para pruebas). */
export interface RedisEval {
  eval(script: string, numkeys: number, ...args: Array<string | number>): Promise<unknown>;
  ttl(key: string): Promise<number>;
}

const WINDOW_LUA = `local c = redis.call('INCR', KEYS[1])
if c == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]) end
return c`;

export class RedisRateLimiter implements RateLimiter {
  private lastWarn = 0;

  constructor(
    private readonly redis: RedisEval,
    private readonly prefix = 'lex:rl:',
  ) {}

  async consume(key: string, limit: number, windowSec: number): Promise<RateLimitResult> {
    const k = `${this.prefix}${key}`;
    try {
      const count = Number(await this.redis.eval(WINDOW_LUA, 1, k, windowSec));
      if (count <= limit) return { allowed: true, retryAfterSec: 0 };
      const ttl = await this.redis.ttl(k);
      return { allowed: false, retryAfterSec: ttl > 0 ? ttl : windowSec };
    } catch {
      this.warn();
      return { allowed: true, retryAfterSec: 0 };
    }
  }

  private warn(): void {
    const now = Date.now();
    if (now - this.lastWarn < 60000) return;
    this.lastWarn = now;
    // eslint-disable-next-line no-console
    console.warn('[ratelimit] Redis no disponible: fail-open temporal');
  }
}
