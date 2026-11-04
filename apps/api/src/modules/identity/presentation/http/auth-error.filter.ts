// Traduce errores de aplicación/dominio a HTTP. Los AuthError llevan su status;
// los DomainError son 400. Fuera de estos, se relanza al filtro global (500).
import { ArgumentsHost, Catch, ExceptionFilter } from '@nestjs/common';
import { AuthError } from '../../application/errors';
import { DomainError } from '../../domain/errors';

@Catch(AuthError, DomainError)
export class AuthErrorFilter implements ExceptionFilter {
  catch(exception: AuthError | DomainError, host: ArgumentsHost): void {
    const res = host.switchToHttp().getResponse() as {
      status(s: number): { json(b: unknown): void };
    };
    if (exception instanceof AuthError) {
      res
        .status(exception.status)
        .json({ statusCode: exception.status, message: exception.message, code: exception.code });
      return;
    }
    res.status(400).json({ statusCode: 400, message: exception.message, code: exception.code });
  }
}
