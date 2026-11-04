import { useState, useEffect } from 'react';
import { cambiarPassword, clearSession } from '../../auth';
import {
  cerrarTodasSesiones,
  totpConfirmar,
  totpDesactivar,
  totpEstado,
  totpRegenerar,
  totpSetup,
  secretoDeOtpauth,
  type TotpEstado,
} from '../../cuenta';
import Bloque, { describeError } from './comun';

export default function Seguridad({ onSesionCerrada }: { onSesionCerrada: () => void }): React.ReactElement {
  const [estado, setEstado] = useState<TotpEstado | null>(null);
  const [restantes, setRestantes] = useState(0);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [otpauth, setOtpauth] = useState('');
  const [codigo, setCodigo] = useState('');
  const [recuperacion, setRecuperacion] = useState<string[]>([]);
  const [guarde, setGuarde] = useState(false);
  const [actual, setActual] = useState('');
  const [nueva, setNueva] = useState('');
  const [claveMsg, setClaveMsg] = useState('');

  async function refrescar(): Promise<void> {
    setErr('');
    try {
      const s = await totpEstado();
      setEstado(s.status);
      setRestantes(s.recovery_codes_left);
    } catch (e) {
      setErr(describeError(e));
    }
  }

  useEffect(() => {
    void refrescar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function iniciar(): Promise<void> {
    setBusy(true);
    setErr('');
    setMsg('');
    try {
      const r = await totpSetup();
      setOtpauth(r.otpauth_url);
      setEstado('pending');
      setCodigo('');
      setRecuperacion([]);
      setGuarde(false);
      setMsg(r.message);
    } catch (e) {
      setErr(describeError(e));
    } finally {
      setBusy(false);
    }
  }

  async function confirmar(): Promise<void> {
    if (codigo.trim().length < 6) {
      setErr('Escribe el código de 6 dígitos de tu app.');
      return;
    }
    setBusy(true);
    setErr('');
    try {
      const r = await totpConfirmar(codigo.trim());
      setRecuperacion(r.recovery_codes);
      setGuarde(false);
      setOtpauth('');
      await refrescar();
      setMsg('2FA activado. Las demás sesiones se cerraron por seguridad; esta se mantiene.');
    } catch (e) {
      setErr(describeError(e));
    } finally {
      setBusy(false);
    }
  }

  async function regenerar(): Promise<void> {
    if (!actual || codigo.trim().length < 6) {
      setErr('Para regenerar necesitas tu contraseña y un código válido.');
      return;
    }
    setBusy(true);
    setErr('');
    try {
      const r = await totpRegenerar(actual, codigo.trim());
      setRecuperacion(r.recovery_codes);
      setGuarde(false);
      setMsg('Códigos regenerados: los anteriores quedaron invalidados.');
    } catch (e) {
      setErr(describeError(e));
    } finally {
      setBusy(false);
    }
  }

  async function desactivar(): Promise<void> {
    if (!actual || codigo.trim().length < 6) {
      setErr('Para desactivar necesitas tu contraseña y un código válido.');
      return;
    }
    setBusy(true);
    setErr('');
    try {
      const m = await totpDesactivar(actual, codigo.trim());
      setMsg(`${m}. Las demás sesiones se cerraron por seguridad; esta se mantiene.`);
      setRecuperacion([]);
      await refrescar();
    } catch (e) {
      setErr(describeError(e));
    } finally {
      setBusy(false);
    }
  }

  async function cambiar(): Promise<void> {
    setErr('');
    setClaveMsg('');
    if (nueva.length < 8) {
      setErr('La nueva contraseña debe tener al menos 8 caracteres.');
      return;
    }
    setBusy(true);
    try {
      const m = await cambiarPassword(actual, nueva);
      setClaveMsg(`${m}. Las demás sesiones se cerraron; esta se mantiene.`);
      setActual('');
      setNueva('');
    } catch (e) {
      setErr(describeError(e));
    } finally {
      setBusy(false);
    }
  }

  const secreto = otpauth ? secretoDeOtpauth(otpauth) : '';

  return (
    <>
      <Bloque titulo="Verificación en dos pasos (TOTP)">
        <p className="meta">
          Estado: <strong>{estado === null ? 'cargando…' : estado === 'active' ? `activado (${restantes} códigos de recuperación disponibles)` : estado === 'pending' ? 'pendiente de confirmar' : 'no configurado'}</strong>
        </p>
        {estado === 'disabled' && (
          <button type="button" onClick={() => void iniciar()} disabled={busy}>
            {busy ? 'Iniciando…' : 'Activar 2FA'}
          </button>
        )}
        {otpauth && (
          <div className="totp-caja">
            <p>
              No usamos QR (la app no incluye librerías nuevas): copia el secreto en tu app
              autenticadora con entrada manual, o abre el enlace en el teléfono.
            </p>
            <label>
              Secreto (copiable)
              <input readOnly value={secreto} onFocus={(e) => e.target.select()} />
            </label>
            <div className="fila">
              <button
                type="button"
                className="secundario-claro"
                onClick={() => {
                  void navigator.clipboard?.writeText(secreto).catch(() => undefined);
                }}
              >
                Copiar secreto
              </button>
              <button
                type="button"
                className="secundario-claro"
                onClick={() => {
                  void navigator.clipboard?.writeText(otpauth).catch(() => undefined);
                }}
              >
                Copiar URI otpauth
              </button>
              <a className="boton-enlace" href={otpauth}>Abrir en la app autenticadora</a>
            </div>
            <p className="meta">
              URI completa: <code className="romper">{otpauth}</code>
            </p>
            <p className="meta">
              Entrada manual: cuenta nueva → clave = el secreto de arriba, tipo “basado en tiempo”,
              6 dígitos. Luego confirma con el código actual.
            </p>
            <label>
              Código de 6 dígitos
              <input value={codigo} onChange={(e) => setCodigo(e.target.value)} placeholder="123456" autoComplete="one-time-code" />
            </label>
            <button type="button" onClick={() => void confirmar()} disabled={busy}>
              {busy ? 'Confirmando…' : 'Confirmar y activar'}
            </button>
          </div>
        )}
        {recuperacion.length > 0 && (
          <div className="totp-caja">
            <p><strong>Guarda estos códigos ahora: se muestran una sola vez.</strong></p>
            <ul className="codigos">
              {recuperacion.map((c) => (
                <li key={c}><code>{c}</code></li>
              ))}
            </ul>
            <div className="fila">
              <button
                type="button"
                className="secundario-claro"
                onClick={() => {
                  void navigator.clipboard?.writeText(recuperacion.join('\n')).catch(() => undefined);
                }}
              >
                Copiar códigos
              </button>
            </div>
            <label className="check">
              <input type="checkbox" checked={guarde} onChange={(e) => setGuarde(e.target.checked)} />
              Los guardé en un lugar seguro
            </label>
            {!guarde && <p className="error">Confirma que los guardaste: no volverán a mostrarse.</p>}
          </div>
        )}
        {estado === 'active' && (
          <>
            <p className="meta">
              Regenerar invalida los códigos anteriores sin cerrar sesiones; desactivar pide
              contraseña + código actual (TOTP o recuperación) y cierra las demás sesiones.
            </p>
            <label>
              Contraseña (para regenerar o desactivar)
              <input type="password" autoComplete="current-password" value={actual} onChange={(e) => setActual(e.target.value)} />
            </label>
            <label>
              Código actual (TOTP o recuperación)
              <input value={codigo} onChange={(e) => setCodigo(e.target.value)} placeholder="123456" autoComplete="one-time-code" />
            </label>
            <div className="fila">
              <button type="button" className="secundario-claro" onClick={() => void regenerar()} disabled={busy}>
                Regenerar códigos
              </button>
              <button type="button" className="secundario-claro peligro" onClick={() => void desactivar()} disabled={busy}>
                Desactivar 2FA
              </button>
            </div>
          </>
        )}
        {msg && <p className="ok">{msg}</p>}
        {err && <p className="error" role="alert">{err}</p>}
      </Bloque>
      <Bloque titulo="Cambiar contraseña">
        <p className="meta">Pide la contraseña actual. Al cambiarla, las demás sesiones se cierran.</p>
        <label>
          Contraseña actual
          <input type="password" autoComplete="current-password" value={actual} onChange={(e) => setActual(e.target.value)} />
        </label>
        <label>
          Contraseña nueva
          <input type="password" autoComplete="new-password" value={nueva} onChange={(e) => setNueva(e.target.value)} placeholder="Mínimo 8 caracteres" />
        </label>
        {claveMsg && <p className="ok">{claveMsg}</p>}
        <button type="button" onClick={() => void cambiar()} disabled={busy || !actual || nueva.length < 8}>
          {busy ? 'Guardando…' : 'Cambiar contraseña'}
        </button>
      </Bloque>
      <Bloque titulo="Cerrar todas las sesiones">
        <p className="meta">Cierra esta y todas las demás sesiones (logout-all). Volverás al inicio de sesión.</p>
        <button
          type="button"
          className="secundario-claro peligro"
          onClick={() => {
            void cerrarTodasSesiones().catch(() => undefined).finally(() => {
              clearSession();
              onSesionCerrada();
            });
          }}
        >
          Cerrar todas las sesiones
        </button>
      </Bloque>
    </>
  );
}
