export interface UsoKind {
  kind: string;
  eventos: number;
  tokens: number;
  costo_usd: number;
}

export interface Metricas {
  usuarios_total: number;
  usuarios_7d: number;
  sesiones_activas: number;
  conversaciones_total: number;
  mensajes_7d: number;
  uso_30d: UsoKind[];
  abstenciones_30d: number;
  tasa_abstencion_30d: number | null;
}

export const OPS_METRICS_REPOSITORY = Symbol('OPS_METRICS_REPOSITORY');

export interface OpsMetricsRepository {
  summary(): Promise<Metricas>;
}
