// Errores del chat sobre AuthError (identity): mismo filtro HTTP.
import { AuthError } from '../../identity';

export function conversacionNoEncontrada(): AuthError {
  return new AuthError(404, 'conversacion_no_encontrada', 'conversación no encontrada');
}

export function mensajeInvalido(msg: string): AuthError {
  return new AuthError(400, 'mensaje_invalido', msg);
}

export function modeloNoPermitido(): AuthError {
  return new AuthError(400, 'modelo_no_permitido', 'modelo no permitido para su plan');
}

export function proyectoNoEncontrado(): AuthError {
  return new AuthError(404, 'proyecto_no_encontrado', 'proyecto no encontrado');
}

export function enlaceNoEncontrado(): AuthError {
  return new AuthError(404, 'enlace_no_encontrado', 'enlace no encontrado o revocado');
}

export function noRegenerable(msg: string): AuthError {
  return new AuthError(400, 'no_regenerable', msg);
}

export function archivoInvalido(msg: string): AuthError {
  return new AuthError(400, 'archivo_invalido', msg);
}

/** B10: moderación pre-vuelo (no revela qué patrón disparó). */
export function contenidoNoPermitido(): AuthError {
  return new AuthError(
    400,
    'contenido_no_permitido',
    'no puedo ayudar con esa solicitud; reformúlela en términos jurídicos',
  );
}

/** B10: respuesta de apoyo ante posible crisis (sin repetir el contenido). */
export function apoyoCrisis(): AuthError {
  return new AuthError(
    400,
    'contenido_no_permitido',
    'si está pasando por una crisis, busque ayuda profesional o de emergencia cuanto antes',
  );
}

export function archivoMuyGrande(msg: string): AuthError {
  return new AuthError(413, 'archivo_muy_grande', msg);
}

export function cuotaArchivos(msg: string): AuthError {
  return new AuthError(400, 'cuota_archivos', msg);
}

export function archivoNoEncontrado(): AuthError {
  return new AuthError(404, 'archivo_no_encontrado', 'archivo no encontrado');
}

export function embeddingsNoDisponibles(): AuthError {
  return new AuthError(503, 'embeddings_no_disponibles', 'servicio de embeddings no disponible; reintente');
}
