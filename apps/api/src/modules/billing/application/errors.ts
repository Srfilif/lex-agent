// Errores de billing sobre AuthError (identity): mismo filtro HTTP.
import { AuthError } from '../../identity';

export function planNoEncontrado(): AuthError {
  return new AuthError(404, 'plan_no_encontrado', 'plan no encontrado o inactivo');
}

export function cuotaAgotada(recurso: string): AuthError {
  return new AuthError(
    429,
    'cuota_agotada',
    `límite mensual de ${recurso} agotado para su plan`,
  );
}

export function firmaWebhookInvalida(): AuthError {
  return new AuthError(401, 'firma_invalida', 'firma de webhook inválida');
}

export function eventoMalformado(): AuthError {
  return new AuthError(400, 'evento_malformado', 'evento de webhook malformado');
}

export function pagoInvalido(msg: string): AuthError {
  return new AuthError(400, 'pago_invalido', msg);
}

export function sinSuscripcion(): AuthError {
  return new AuthError(404, 'sin_suscripcion', 'sin suscripción activa');
}
