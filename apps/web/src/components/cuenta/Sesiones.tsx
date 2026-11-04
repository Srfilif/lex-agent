import { useState, useEffect } from 'react';
import { clearSession } from '../../auth';
import {
  listarSesiones,
  revocarSesion,
  type Sesion,
} from '../../cuenta';
import Bloque, { describeError } from './comun';

export default function Sesiones({ onSesionCerrada }: { onSesionCerrada: () => void }): React.ReactElement {
  const [lista, setLista] = useState<Sesion[]>([]);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [cargando, setCargando] = useState(true);

  async function cargar(): Promise<void> {
    setCargando(true);
    setErr('');
    try {
      setLista(await listarSesiones());
    } catch (e) {
      setErr(describeError(e));
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    void cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function revocar(s: Sesion): Promise<void> {
    setBusy(true);
    setErr('');
    setMsg('');
    try {
      await revocarSesion(s.id);
      if (s.current) {
        clearSession();
        onSesionCerrada();
        return;
      }
      setMsg('Sesión revocada.');
      await cargar();
    } catch (e) {
      setErr(describeError(e));
    } finally {
      setBusy(false);
    }
  }

  if (cargando) return <p className="meta">Cargando sesiones…</p>;

  return (
    <Bloque titulo="Sesiones activas">
      <p className="meta">
        El servidor entrega dispositivo, actividad y cuál es la actual (no incluye la IP en esta vista).
      </p>
      {err && <p className="error" role="alert">{err}</p>}
      {msg && <p className="ok">{msg}</p>}
      {lista.length === 0 && !err && <p className="meta">No hay sesiones activas.</p>}
      <ul className="sesiones">
        {lista.map((s) => (
          <li key={s.id} className={s.current ? 'actual' : ''}>
            <div>
              <strong>{s.device_label || 'Dispositivo desconocido'}</strong>
              {s.current && <span className="etiqueta">actual</span>}
              <br />
              <span className="meta">
                Última actividad: {s.last_seen_at ? new Date(s.last_seen_at).toLocaleString('es-CO') : '—'}
                {' · '}Creada: {s.created_at ? new Date(s.created_at).toLocaleString('es-CO') : '—'}
                {' · '}Expira: {s.expires_at ? new Date(s.expires_at).toLocaleString('es-CO') : '—'}
              </span>
            </div>
            <button type="button" className="secundario-claro" disabled={busy} onClick={() => void revocar(s)}>
              Revocar
            </button>
          </li>
        ))}
      </ul>
      <button type="button" className="secundario-claro" onClick={() => void cargar()} disabled={busy}>
        Recargar
      </button>
    </Bloque>
  );
}
