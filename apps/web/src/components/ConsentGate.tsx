import { useState } from 'react';
import { aceptarConsentimientos, type ConsentState } from '../cuenta';
import { PRIVACY_VERSION, TERMS_VERSION, URL_PRIVACIDAD, URL_TERMINOS } from '../legal';
import { Alert, AlertDescription } from './ui/alert';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Checkbox } from './ui/checkbox';

/**
 * Puerta de consentimiento para cuentas creadas antes de la migración 019
 * (o ante nuevas versiones legales): bloquea la app hasta aceptar términos
 * y autorizar datos, en casillas independientes. Registra versión + fecha.
 */
export default function ConsentGate({
  estado,
  onAceptado,
  onSalir,
}: {
  estado: ConsentState;
  onAceptado: () => void;
  onSalir: () => void;
}): React.ReactElement {
  const [terminos, setTerminos] = useState(false);
  const [datos, setDatos] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function aceptar(): Promise<void> {
    if (!terminos || !datos) {
      setError('Marca ambas casillas: son aceptaciones independientes y obligatorias.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await aceptarConsentimientos(true, true);
      onAceptado();
    } catch (e) {
      setError((e as Error).message || 'No se pudo registrar. Inténtalo de nuevo.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-wrap">
      <Card className="w-full max-w-[520px] gap-0 border-border py-0 shadow-[var(--shadow-3)]">
        <CardHeader className="gap-1.5 border-b border-border px-6 py-5">
          <CardTitle className="font-heading text-xl font-semibold">
            Actualizamos las condiciones legales
          </CardTitle>
          <CardDescription>
            Para seguir usando Kelsyx acepta los Términos (v{TERMS_VERSION}) y autorice el
            tratamiento de datos (v{PRIVACY_VERSION}). Quedarán registrados con fecha y hora.
            Estado actual: {estado.complete ? 'completo' : 'pendiente'}.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 px-6 py-5">
          <label className="check flex items-start gap-2">
            <Checkbox checked={terminos} onCheckedChange={(c) => setTerminos(c === true)} />
            <span>
              Acepto los{' '}
              <a href={URL_TERMINOS} target="_blank" rel="noreferrer">
                Términos del Servicio (v{TERMS_VERSION})
              </a>
            </span>
          </label>
          <label className="check flex items-start gap-2">
            <Checkbox checked={datos} onCheckedChange={(c) => setDatos(c === true)} />
            <span>
              Autorizo el tratamiento de mis datos según la{' '}
              <a href={URL_PRIVACIDAD} target="_blank" rel="noreferrer">
                Política de Datos (v{PRIVACY_VERSION})
              </a>
              , incluidas las transferencias a proveedores de IA descritas en ella
            </span>
          </label>
          {error && (
            <Alert variant="destructive" className="border-destructive/30 bg-destructive/5">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={() => void aceptar()} disabled={busy}>
              {busy ? 'Registrando…' : 'Aceptar y continuar'}
            </Button>
            <Button type="button" variant="outline" onClick={onSalir} disabled={busy}>
              Salir sin aceptar
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
