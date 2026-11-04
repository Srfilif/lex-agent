import { AuthHttpError, mensajeError } from '../../auth';

export function describeError(e: unknown): string {
  if (e instanceof AuthHttpError) {
    if (e.status === 403) return 'Sin permiso para esa acción.';
    return mensajeError(e.status, e.message);
  }
  return (e as Error).message || 'Ocurrió un error inesperado.';
}

export default function Bloque({ titulo, children }: { titulo: string; children: React.ReactNode }): React.ReactElement {
  return (
    <section className="cuenta-bloque">
      <h3>{titulo}</h3>
      {children}
    </section>
  );
}
