import { AuthHttpError, mensajeError } from '../../auth';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';

export function describeError(e: unknown): string {
  if (e instanceof AuthHttpError) {
    if (e.status === 403) return 'Sin permiso para esa acción.';
    return mensajeError(e.status, e.message);
  }
  return (e as Error).message || 'Ocurrió un error inesperado.';
}

export default function Bloque({
  titulo,
  children,
}: {
  titulo: string;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <Card className="cuenta-bloque gap-0 border-0 px-0 py-0 shadow-sm">
      <CardHeader className="border-b border-border px-5 py-4">
        <CardTitle className="font-heading text-base font-semibold">{titulo}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 px-5 py-4">{children}</CardContent>
    </Card>
  );
}
