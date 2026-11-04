import { useState } from 'react';
import {
  confirmarCambioEmail,
  fetchMe,
  patchPerfil,
  solicitarCambioEmail,
  type Me,
} from '../../cuenta';
import Bloque, { describeError } from './comun';

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
        <label>
          Nombre para mostrar
          <input value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={80} placeholder="Tu nombre" />
        </label>
        {err && <p className="error" role="alert">{err}</p>}
        {msg && <p className="ok">{msg}</p>}
        <button type="button" onClick={() => void guardar()} disabled={busy || !nombre.trim()}>
          {busy ? 'Guardando…' : 'Guardar nombre'}
        </button>
      </Bloque>
      <Bloque titulo="Cambiar correo">
        <p className="meta">
          Te pedimos la contraseña actual y enviamos un token al correo <em>nuevo</em> (válido 24 h).
          Al confirmar, las demás sesiones se cierran por seguridad.
        </p>
        <label>
          Contraseña actual
          <input type="password" autoComplete="current-password" value={pw} onChange={(e) => setPw(e.target.value)} />
        </label>
        <label>
          Correo nuevo
          <input type="email" value={nuevo} onChange={(e) => setNuevo(e.target.value)} placeholder="nuevo@ejemplo.co" />
        </label>
        {emailErr && <p className="error" role="alert">{emailErr}</p>}
        {emailMsg && <p className="ok">{emailMsg}</p>}
        <button type="button" onClick={() => void pedirCambio()} disabled={emailBusy || !pw || !nuevo.includes('@')}>
          {emailBusy ? 'Enviando…' : 'Enviar token al correo nuevo'}
        </button>
        <label>
          Token recibido en el correo nuevo
          <input value={token} onChange={(e) => setToken(e.target.value)} placeholder="Pega el token aquí" />
        </label>
        {confMsg && <p className="ok">{confMsg}</p>}
        <button type="button" className="secundario-claro" onClick={() => void confirmar()} disabled={emailBusy || !token.trim()}>
          Confirmar cambio de correo
        </button>
      </Bloque>
    </>
  );
}
