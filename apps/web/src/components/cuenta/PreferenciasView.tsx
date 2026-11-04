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
          <label>
            Tema (se aplica de inmediato)
            <select
              value={prefs.theme}
              disabled={busy}
              onChange={(e) => void guardar({ theme: e.target.value })}
            >
              <option value="light">Claro</option>
              <option value="dark">Oscuro</option>
              <option value="system">Sistema</option>
            </select>
          </label>
          <label>
            Idioma (se guarda; la interfaz sigue en español por ahora)
            <select value={prefs.language} disabled={busy} onChange={(e) => void guardar({ language: e.target.value })}>
              <option value="es">Español</option>
              <option value="en">English</option>
            </select>
          </label>
          <label>
            Zona horaria (se guarda; los horarios se muestran tal cual los entrega el servidor)
            <select
              value={ZONAS.includes(prefs.timezone) ? prefs.timezone : 'America/Bogota'}
              disabled={busy}
              onChange={(e) => void guardar({ timezone: e.target.value })}
            >
              {ZONAS.map((z) => (
                <option key={z} value={z}>{z}</option>
              ))}
            </select>
          </label>
        </div>
      </Bloque>
      <Bloque titulo="Notificaciones">
        <label className="check">
          <input
            type="checkbox"
            checked={prefs.notifications.emailSecurity}
            disabled={busy}
            onChange={(e) => void guardar({ notifications: { emailSecurity: e.target.checked } })}
          />
          Recibir avisos de seguridad por correo (se guarda la preferencia)
        </label>
      </Bloque>
      <Bloque titulo="Asistente (IA)">
        <p className="meta">
          El modelo se usa en el chat si tu plan lo permite; si el plan no lo incluye, el servidor
          lo rechaza y el chat sigue con el modelo por defecto.
        </p>
        <div className="fila">
          <label>
            Modelo preferido (vacío = por defecto del servidor)
            <input
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
          <label>
            Detalle (se guarda)
            <select
              value={prefs.ai.detail}
              disabled={busy}
              onChange={(e) => void guardar({ ai: { detail: e.target.value } })}
            >
              <option value="breve">Breve</option>
              <option value="normal">Normal</option>
              <option value="detallado">Detallado</option>
            </select>
          </label>
          <label>
            Formato de respuesta (se guarda)
            <select
              value={prefs.ai.responseFormat}
              disabled={busy}
              onChange={(e) => void guardar({ ai: { responseFormat: e.target.value } })}
            >
              <option value="markdown">Markdown</option>
              <option value="texto">Texto</option>
            </select>
          </label>
        </div>
        <label className="check">
          <input
            type="checkbox"
            checked={prefs.ai.crossMemory}
            disabled={busy}
            onChange={(e) => void guardar({ ai: { crossMemory: e.target.checked } })}
          />
          Memoria entre chats: recordar hechos en todos los hilos (se puede desactivar y borrar)
        </label>
        {err && <p className="error" role="alert">{err}</p>}
        {msg && <p className="ok">{msg}</p>}
      </Bloque>
      <Bloque titulo="Memoria">
        <RecuerdosView />
      </Bloque>
    </>
  );
}
