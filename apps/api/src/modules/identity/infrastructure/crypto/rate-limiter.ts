// Rate-limit en memoria (ventana deslizante por clave).
// Válido para despliegue de una réplica; multirréplica exige Redis (ver docs).
// `nowMs` inyectable para pruebas.
import { RateLimiter, RateLimitResult } from '../../application/ports';

const MAX_KEYS = 10000;

export class MemoryRateLimiter implements RateLimiter {
  private hits = new Map<string, number[]>();

  async consume(
    key: string,
    limit: number,
    windowSec: number,
    nowMs = Date.now(),
  ): Promise<RateLimitResult> {
    const windowMs = windowSec * 1000;
    const cutoff = nowMs - windowMs;
    let arr = this.hits.get(key);
    if (!arr) {
      arr = [];
      this.hits.set(key, arr);
      if (this.hits.size > MAX_KEYS) {
        const first = this.hits.keys().next();
        if (!first.done) this.hits.delete(first.value);
      }
    }
    while (arr.length && (arr[0] as number) <= cutoff) arr.shift();
    if (arr.length >= limit) {
      const retryAfterSec = Math.max(1, Math.ceil(((arr[0] as number) + windowMs - nowMs) / 1000));
      return { allowed: false, retryAfterSec };
    }
    arr.push(nowMs);
    return { allowed: true, retryAfterSec: 0 };
  }
}
