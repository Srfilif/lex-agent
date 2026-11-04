import { useState } from 'react';
import { clearSession } from '../../auth';
import {
  confirmarBorrado,
  exportarCuenta,
  solicitarBorrado,
  type Me,
} from '../../cuenta';
import Bloque, { describeError } from './comun';

export default function Datos({ me, onSesionCerrada }: { me: Me; onSesionCerrada: () => void }): React.ReactElement {
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [pw, setPw] = useState('');
  const [token, setToken] = useState('');
  const [confirmo, setConfirmo] = useState(false);

  function descargar(nombre: string, contenido: string): void {
    const blob = new Blob([contenido], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = nombre;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  async function exportar(): Promise<void> {
    setBusy(true);
    setErr('');
    setMsg('');
    try {
      const f = await exportarCuenta();
      descargar(f.nombre, f.contenido);
      setMsg(`Archivo descargado: ${f.nombre}`);
    } catch (e) {
      setErr(describeError(e));
    } finally {
      setBusy(false);
    }
  }

  async function pedir(): Promise<void> {
    setBusy(true);
    setErr('');
    setMsg('');
    try {
      const m = await solicitarBorrado();
      setMsg(`${m} En desarrollo, el token llega por correo o por el registro del servidor.`);
    } catch (e) {
      setErr(describeError(e));
    } finally {
      setBusy(false);
    }
  }

  async function confirmar(): Promise<void> {
    if (!confirmo) {
      setErr('Marca la casilla de confirmación: el borrado es irreversible.');
      return;
    }
    setBusy(true);
    setErr('');
    try {
      await confirmarBorrado(pw, token.trim());
      clearSession();
      onSesionCerrada();
    } catch (e) {
      setErr(describeError(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Bloque titulo="Exportar mis datos">
        <p className="meta">Descarga una copia de tu cuenta en JSON (perfil, preferencias e historial disponible).</p>
        {msg && <p className="ok">{msg}</p>}
        {err && <p className="error" role="alert">{err}</p>}
        <button type="button" onClick={() => void exportar()} disabled={busy}>
          {busy ? 'Generando…' : 'Descargar mis datos'}
        </button>
      </Bloque>
      <Bloque titulo="Borrar cuenta">
        <p className="meta">
          Consecuencias: se anonimiza tu perfil, se cierran tus sesiones y se pierde el acceso a
          tus chats. La información de facturación se conserva por obligación legal y la auditoría
          anonimizada hasta 1 año. Es irreversible.
        </p>
        <p className="meta">Cuenta: {me.email} — primero solicita el token y luego confírmalo con tu contraseña.</p>
        <button type="button" className="secundario-claro peligro" onClick={() => void pedir()} disabled={busy}>
          Solicitar token de borrado
        </button>
        <label>
          Contraseña
          <input type="password" autoComplete="current-password" value={pw} onChange={(e) => setPw(e.target.value)} />
        </label>
        <label>
          Token de borrado
          <input value={token} onChange={(e) => setToken(e.target.value)} placeholder="Pega el token" />
        </label>
        <label className="check">
          <input type="checkbox" checked={confirmo} onChange={(e) => setConfirmo(e.target.checked)} />
          Entiendo que el borrado es irreversible y acepto las consecuencias descritas
        </label>
        <button
          type="button"
          className="peligro-solido"
          onClick={() => void confirmar()}
          disabled={busy || !pw || !token.trim() || !confirmo}
        >
          {busy ? 'Borrando…' : 'Borrar mi cuenta definitivamente'}
        </button>
      </Bloque>
    </>
  );
}
