// Errores de aplicación de identidad: llevan status HTTP seguro pero la clase
// no depende de Nest; la presentación los traduce (auth-error.filter.ts).

export class AuthError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'AuthError';
  }
}

export function credencialesInvalidas(): AuthError {
  // Genérico a propósito: no distingue "no existe" de "clave mala".
  return new AuthError(401, 'credenciales_invalidas', 'correo o contraseña inválidos');
}

export function cuentaNoDisponible(): AuthError {
  return new AuthError(403, 'cuenta_no_disponible', 'cuenta deshabilitada o eliminada');
}

export function tokenInvalido(): AuthError {
  return new AuthError(401, 'token_invalido', 'token inválido o expirado');
}

export function sesionRevocada(): AuthError {
  return new AuthError(401, 'sesion_revocada', 'sesión terminada; inicie sesión de nuevo');
}

export function reusoDetectado(): AuthError {
  return new AuthError(401, 'reuso_detectado', 'sesión comprometida; inicie sesión de nuevo');
}

export function noAutenticado(): AuthError {
  return new AuthError(401, 'no_autenticado', 'se requiere autenticación');
}

export function prohibido(): AuthError {
  return new AuthError(403, 'prohibido', 'sin permiso para esta operación');
}

export function mfaRequerido(): AuthError {
  return new AuthError(403, 'mfa_requerido', 'esta operación exige sesión verificada con 2FA');
}

export function limiteExcedido(retryAfterSec: number): AuthError {
  const e = new AuthError(429, 'limite_excedido', 'demasiados intentos; espere y reintente');
  (e as { retryAfterSec?: number }).retryAfterSec = retryAfterSec;
  return e;
}

export function noEncontrado(msg = 'no encontrado'): AuthError {
  return new AuthError(404, 'no_encontrado', msg);
}

export function codigoInvalido(): AuthError {
  return new AuthError(401, 'codigo_invalido', 'código inválido o expirado');
}

export function totpNoConfigurado(): AuthError {
  return new AuthError(400, 'totp_no_configurado', '2FA no está configurado');
}

export function totpSinPendiente(): AuthError {
  return new AuthError(400, 'totp_sin_pendiente', 'no hay configuración pendiente; inicie de nuevo');
}

export function totpYaActivo(): AuthError {
  return new AuthError(409, 'totp_ya_activo', '2FA ya está activado');
}

export function operacionNoPermitida(msg: string): AuthError {
  return new AuthError(400, 'operacion_no_permitida', msg);
}

export function registroCerrado(): AuthError {
  return new AuthError(403, 'registro_cerrado', 'el registro está cerrado por el momento');
}

export function correoNoAutorizado(): AuthError {
  return new AuthError(403, 'correo_no_autorizado', 'este correo no está autorizado a registrarse');
}

export function codigoAccesoInvalido(): AuthError {
  return new AuthError(403, 'codigo_acceso_invalido', 'código de acceso inválido o agotado');
}

export function mantenimiento(): AuthError {
  return new AuthError(
    403,
    'mantenimiento',
    'plataforma en mantenimiento: solo administradores',
  );
}
