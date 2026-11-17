import { useState } from 'react';
import {
  confirmarCambioEmail,
  fetchMe,
  patchPerfil,
  solicitarCambioEmail,
  type Me,
} from '../../cuenta';
import Bloque, { describeError } from './comun';
import { Alert, AlertDescription } from '../ui/alert';
import { Button } from '../ui/button';
import { Input } from '../ui/input';

export default function Perfil({ me, onMe }: { me: Me; onMe: (m: Me) => void }): React.ReactElement {
  const [nombre, setNombre] = useState(me.display_name ?? '');
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [pw, setPw] = useState('');
  const [nuevo, setNuevo] = useState('');
  const [emailMsg, setEmailMsg] = useState('');
  const [emailErr, setEmailErr] = useState('');
  const [emailBusy, setEmailBusy] = useState(false);
  const [token, setToken] = useState('');
  const [confMsg, setConfMsg] = useState('');

  async function guardar(): Promise<void> {
    setBusy(true);
    setErr('');
    setMsg('');
    try {
      onMe(await patchPerfil(nombre.trim()));
      setMsg('Nombre actualizado.');
    } catch (e) {
      setErr(describeError(e));
    } finally {
      setBusy(false);
    }
  }

  async function pedirCambio(): Promise<void> {
    setEmailBusy(true);
    setEmailErr('');
    setEmailMsg('');
    try {
      const m = await solicitarCambioEmail(pw, nuevo.trim());
      setEmailMsg(`${m} Revisa la bandeja del correo nuevo: ahí llega el token.`);
    } catch (e) {
      setEmailErr(describeError(e));
    } finally {
      setEmailBusy(false);
    }
  }

  async function confirmar(): Promise<void> {
    setEmailBusy(true);
    setEmailErr('');
    try {
      const m = await confirmarCambioEmail(token.trim());
      setConfMsg(m);
      onMe(await fetchMe());
      setPw('');
      setNuevo('');
      setToken('');
      setEmailMsg('');
    } catch (e) {
      setEmailErr(describeError(e));
    } finally {
      setEmailBusy(false);
    }
  }

  return (
    <>
      <Bloque titulo="Perfil">
        <dl className="datos">
          <div><dt>Correo</dt><dd>{me.email}</dd></div>
          <div><dt>Nombre</dt><dd>{me.display_name || '—'}</dd></div>
          <div><dt>Rol</dt><dd>{me.role}</dd></div>
          <div><dt>Verificación</dt><dd>{me.email_verified ? 'Correo verificado' : 'Correo sin verificar'}</dd></div>
          <div><dt>Cuenta creada</dt><dd>{me.created_at ? new Date(me.created_at).toLocaleString('es-CO') : '—'}</dd></div>
        </dl>
        <label className="flex flex-col gap-1.5">
          Nombre para mostrar
          <Input value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={80} placeholder="Tu nombre" />
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
        <Button type="button" onClick={() => void guardar()} disabled={busy || !nombre.trim()}>
          {busy ? 'Guardando…' : 'Guardar nombre'}
        </Button>
      </Bloque>
      <Bloque titulo="Cambiar correo">
        <p className="meta">
          Te pedimos la contraseña actual y enviamos un token al correo <em>nuevo</em> (válido 24 h).
          Al confirmar, las demás sesiones se cierran por seguridad.
        </p>
        <label className="flex flex-col gap-1.5">
          Contraseña actual
          <Input type="password" autoComplete="current-password" value={pw} onChange={(e) => setPw(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1.5">
          Correo nuevo
          <Input type="email" value={nuevo} onChange={(e) => setNuevo(e.target.value)} placeholder="nuevo@ejemplo.co" />
        </label>
        {emailErr && (
          <Alert variant="destructive" className="border-destructive/30 bg-destructive/5">
            <AlertDescription>{emailErr}</AlertDescription>
          </Alert>
        )}
        {emailMsg && (
          <Alert className="border-primary/20 bg-primary/5">
            <AlertDescription className="text-foreground">{emailMsg}</AlertDescription>
          </Alert>
        )}
        <Button type="button" onClick={() => void pedirCambio()} disabled={emailBusy || !pw || !nuevo.includes('@')}>
          {emailBusy ? 'Enviando…' : 'Enviar token al correo nuevo'}
        </Button>
        <label className="flex flex-col gap-1.5">
          Token recibido en el correo nuevo
          <Input value={token} onChange={(e) => setToken(e.target.value)} placeholder="Pega el token aquí" />
        </label>
        {confMsg && (
          <Alert className="border-primary/20 bg-primary/5">
            <AlertDescription className="text-foreground">{confMsg}</AlertDescription>
          </Alert>
        )}
        <Button type="button" variant="outline" onClick={() => void confirmar()} disabled={emailBusy || !token.trim()}>
          Confirmar cambio de correo
        </Button>
      </Bloque>
    </>
  );
}
