// I1: logger JSON mínimo para producción (sin deps). En dev se usa el de Nest.
import { LoggerService } from '@nestjs/common';

type Level = 'log' | 'error' | 'warn' | 'debug' | 'verbose';

export class JsonLogger implements LoggerService {
  private line(level: Level, message: unknown, context?: string): void {
    const row = {
      t: new Date().toISOString(),
      level,
      ctx: context ?? 'app',
      msg: typeof message === 'string' ? message : JSON.stringify(message),
    };
    const out = JSON.stringify(row);
    if (level === 'error' || level === 'warn') process.stderr.write(`${out}\n`);
    else process.stdout.write(`${out}\n`);
  }

  log(message: unknown, context?: string): void {
    this.line('log', message, context);
  }
  error(message: unknown, context?: string): void {
    this.line('error', message, context);
  }
  warn(message: unknown, context?: string): void {
    this.line('warn', message, context);
  }
  debug(message: unknown, context?: string): void {
    this.line('debug', message, context);
  }
  verbose(message: unknown, context?: string): void {
    this.line('verbose', message, context);
  }
}
