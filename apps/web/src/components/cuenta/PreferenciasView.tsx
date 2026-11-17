import { useState, useEffect } from 'react';
import {
  fetchPreferencias,
  patchPreferencias,
  type Preferencias,
} from '../../cuenta';
import Bloque, { describeError } from './comun';
const ZONAS = [
  'America/Bogota',
  'America/Lima',
  'America/Mexico_City',
  'America/Santiago',
  'America/Caracas',
  'America/Guayaquil',
  'America/Panama',
  'America/Costa_Rica',
  'America/La_Paz',
  'America/Asuncion',
  'America/Montevideo',
  'America/Havana',
  'America/Santo_Domingo',
  'America/New_York',
  'Europe/Madrid',
  'Europe/London',
];
import RecuerdosView from './RecuerdosView';
import { aplicarTema } from '../../shared/tema';
import { Alert, AlertDescription } from '../ui/alert';
import { Checkbox } from '../ui/checkbox';
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';

export default function PreferenciasView({ onPrefs }: { onPrefs: (p: Preferencias) => void }): React.ReactElement {
  const [prefs, setPrefs] = useState<Preferencias | null>(null);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    let vivo = true;
    fetchPreferencias()
      .then((p) => {
        if (vivo) {
          setPrefs(p);
          aplicarTema(p.theme);
        }
      })
      .catch((e: unknown) => {
        if (vivo) setErr(describeError(e));
      })
      .finally(() => {
        if (vivo) setCargando(false);
      });
    return () => {
      vivo = false;
    };
  }, []);

  async function guardar(parche: Record<string, unknown>): Promise<void> {
    setBusy(true);
    setErr('');
    setMsg('');
    try {
      const p = await patchPreferencias(parche);
      setPrefs(p);
      aplicarTema(p.theme);
      onPrefs(p);
      setMsg('Preferencias guardadas.');
    } catch (e) {
      setErr(describeError(e));
    } finally {
      setBusy(false);
    }
  }

  if (cargando) return <p className="meta">Cargando preferencias…</p>;
  if (!prefs) return <p className="error" role="alert">{err || 'No se pudieron cargar las preferencias.'}</p>;

  return (
    <>
      <Bloque titulo="Apariencia e idioma">
        <div className="fila">
          <label className="flex flex-col gap-1.5">
            Tema (se aplica de inmediato)
            <Select
              value={prefs.theme}
              disabled={busy}
              onValueChange={(value) => void guardar({ theme: value })}
            >
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="light">Claro</SelectItem>
                <SelectItem value="dark">Oscuro</SelectItem>
                <SelectItem value="system">Sistema</SelectItem>
              </SelectContent>
            </Select>
          </label>
          <label className="flex flex-col gap-1.5">
            Idioma (se guarda; la interfaz sigue en español por ahora)
            <Select
              value={prefs.language}
              disabled={busy}
              onValueChange={(value) => void guardar({ language: value })}
            >
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="es">Español</SelectItem>
                <SelectItem value="en">English</SelectItem>
              </SelectContent>
            </Select>
          </label>
          <label className="flex flex-col gap-1.5">
            Zona horaria (se guarda; los horarios se muestran tal cual los entrega el servidor)
            <Select
              value={ZONAS.includes(prefs.timezone) ? prefs.timezone : 'America/Bogota'}
              disabled={busy}
              onValueChange={(value) => void guardar({ timezone: value })}
            >
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                {ZONAS.map((z) => (
                  <SelectItem key={z} value={z}>{z}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
        </div>
      </Bloque>
      <Bloque titulo="Notificaciones">
        <label className="check flex items-start gap-2">
          <Checkbox
            checked={prefs.notifications.emailSecurity}
            disabled={busy}
            onCheckedChange={(checked) =>
              void guardar({ notifications: { emailSecurity: checked === true } })
            }
          />
          <span>Recibir avisos de seguridad por correo (se guarda la preferencia)</span>
        </label>
      </Bloque>
      <Bloque titulo="Asistente (IA)">
        <p className="meta">
          El modelo se usa en el chat si tu plan lo permite; si el plan no lo incluye, el servidor
          lo rechaza y el chat sigue con el modelo por defecto.
        </p>
        <div className="fila">
          <label className="flex flex-col gap-1.5">
            Modelo preferido (vacío = por defecto del servidor)
            <Input
              defaultValue={prefs.ai.model ?? ''}
              key={prefs.ai.model ?? 'vacio'}
              disabled={busy}
              maxLength={80}
              placeholder="p. ej. muse-spark-1.3"
              onBlur={(e) => {
                const v = e.target.value.trim();
                if ((v || null) !== prefs.ai.model) void guardar({ ai: { model: v || null } });
              }}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            Detalle (se guarda)
            <Select
              value={prefs.ai.detail}
              disabled={busy}
              onValueChange={(value) => void guardar({ ai: { detail: value } })}
            >
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="breve">Breve</SelectItem>
                <SelectItem value="normal">Normal</SelectItem>
                <SelectItem value="detallado">Detallado</SelectItem>
              </SelectContent>
            </Select>
          </label>
          <label className="flex flex-col gap-1.5">
            Formato de respuesta (se guarda)
            <Select
              value={prefs.ai.responseFormat}
              disabled={busy}
              onValueChange={(value) => void guardar({ ai: { responseFormat: value } })}
            >
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="markdown">Markdown</SelectItem>
                <SelectItem value="texto">Texto</SelectItem>
              </SelectContent>
            </Select>
          </label>
        </div>
        <label className="check flex items-start gap-2">
          <Checkbox
            checked={prefs.ai.crossMemory}
            disabled={busy}
            onCheckedChange={(checked) => void guardar({ ai: { crossMemory: checked === true } })}
          />
          <span>Memoria entre chats: recordar hechos en todos los hilos (se puede desactivar y borrar)</span>
        </label>
        {err && (
          <Alert variant="destructive" className="border-destructive/30 bg-destructive/5">
            <AlertDescription>{err}</AlertDescription>
          </Alert>
        )}
        {msg && (
          <Alert className="border-primary/20 bg-primary/5">
            <AlertDescription className="text-foreground">{msg}</AlertDescription>
          </Alert>
        )}
      </Bloque>
      <Bloque titulo="Memoria">
        <RecuerdosView />
      </Bloque>
    </>
  );
}
