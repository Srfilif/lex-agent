import { useState } from 'react';
import { clearSession } from '../../auth';
import {
  confirmarBorrado,
  exportarCuenta,
  solicitarBorrado,
  type Me,
} from '../../cuenta';
import Bloque, { describeError } from './comun';
import { Alert, AlertDescription } from '../ui/alert';
import { Button } from '../ui/button';
import { Checkbox } from '../ui/checkbox';
import { Input } from '../ui/input';

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
        {msg && (
          <Alert className="border-primary/20 bg-primary/5">
            <AlertDescription className="text-foreground">{msg}</AlertDescription>
          </Alert>
        )}
        {err && (
          <Alert variant="destructive" className="border-destructive/30 bg-destructive/5">
            <AlertDescription>{err}</AlertDescription>
          </Alert>
        )}
        <Button type="button" onClick={() => void exportar()} disabled={busy}>
          {busy ? 'Generando…' : 'Descargar mis datos'}
        </Button>
      </Bloque>
      <Bloque titulo="Borrar cuenta">
        <p className="meta">
          Consecuencias: se anonimiza tu perfil, se cierran tus sesiones y se pierde el acceso a
          tus chats. La información de facturación se conserva por obligación legal y la auditoría
          anonimizada hasta 1 año. Es irreversible.
        </p>
        <p className="meta">Cuenta: {me.email} — primero solicita el token y luego confírmalo con tu contraseña.</p>
        <Button type="button" variant="outline" className="w-fit text-destructive" onClick={() => void pedir()} disabled={busy}>
          Solicitar token de borrado
        </Button>
        <label className="flex flex-col gap-1.5">
          Contraseña
          <Input type="password" autoComplete="current-password" value={pw} onChange={(e) => setPw(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1.5">
          Token de borrado
          <Input value={token} onChange={(e) => setToken(e.target.value)} placeholder="Pega el token" />
        </label>
        <label className="check flex items-start gap-2">
          <Checkbox checked={confirmo} onCheckedChange={(checked) => setConfirmo(checked === true)} />
          <span>Entiendo que el borrado es irreversible y acepto las consecuencias descritas</span>
        </label>
        <Button
          type="button"
          variant="destructive"
          className="w-fit"
          onClick={() => void confirmar()}
          disabled={busy || !pw || !token.trim() || !confirmo}
        >
          {busy ? 'Borrando…' : 'Borrar mi cuenta definitivamente'}
        </Button>
      </Bloque>
    </>
  );
}
