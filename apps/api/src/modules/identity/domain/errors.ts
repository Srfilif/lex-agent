// Errores del dominio de identidad. Puros (sin Nest ni HTTP);
// la presentación los traduce a HTTP (auth-error.filter.ts).

export class DomainError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'DomainError';
  }
}

export function emailInvalido(): DomainError {
  return new DomainError('email_invalido', 'correo electrónico inválido');
}

export function passwordDebil(): DomainError {
  return new DomainError('password_debil', 'la contraseña debe tener entre 8 y 256 caracteres');
}

export function nombreInvalido(): DomainError {
  return new DomainError('nombre_invalido', 'nombre visible inválido (máx. 80 caracteres)');
}

export function patronInvalido(): DomainError {
  return new DomainError(
    'patron_invalido',
    'patrón inválido: correo exacto o *@dominio.tld',
  );
}
