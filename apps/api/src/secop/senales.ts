// Reglas de señales SECOP explicables (indicios, no acusaciones). Puro.

export interface Senal {
  regla: string;
  detalle: string;
}

export function evaluarSenales(r: {
  modalidad_de_contratacion?: unknown;
  dias_adicionados?: unknown;
  valor_del_contrato?: unknown;
  valor_facturado?: unknown;
}): Senal[] {
  const out: Senal[] = [];
  const mod = String(r.modalidad_de_contratacion ?? '').toUpperCase();
  if (mod.includes('DIRECTA')) {
    out.push({
      regla: 'contratacion_directa',
      detalle: `Modalidad: ${r.modalidad_de_contratacion}. Revisar justificación.`,
    });
  }
  const dias = r.dias_adicionados as number;
  if (Number.isFinite(dias) && dias > 0) {
    out.push({ regla: 'dias_adicionados', detalle: `${dias} día(s) adicionados.` });
  }
  const total = r.valor_del_contrato as number;
  const fact = r.valor_facturado as number;
  if (Number.isFinite(total) && Number.isFinite(fact) && total > 0 && fact > total) {
    out.push({
      regla: 'facturado_mayor_contrato',
      detalle: `Facturado (${fact}) supera valor del contrato (${total}).`,
    });
  }
  return out;
}
