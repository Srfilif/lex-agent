// Escritor SSE mínimo (event: + data: JSON). Interfaz estructural:
// no requiere @types/express.

export interface SseResponse {
  setHeader(name: string, value: string): void;
  flushHeaders?: () => void;
  write(chunk: string): boolean;
  end(): void;
  on(event: 'close', cb: () => void): void;
}

/** Serializa un evento SSE (data multilínea partida por spec). */
export function formatSse(event: string, data: unknown): string {
  const json = JSON.stringify(data);
  const lines = json.split('\n').map((l) => `data: ${l}`).join('\n');
  return `event: ${event}\n${lines}\n\n`;
}

export class SseWriter {
  private closed = false;

  constructor(private readonly res: SseResponse) {
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();
    res.on('close', () => {
      this.closed = true;
    });
  }

  get isClosed(): boolean {
    return this.closed;
  }

  send(event: string, data: unknown): void {
    if (this.closed) return;
    this.res.write(formatSse(event, data));
  }

  end(): void {
    if (this.closed) return;
    this.closed = true;
    this.res.end();
  }
}
