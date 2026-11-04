import { useState } from 'react';
import {
  AuthHttpError,
  confirmarReset,
  getEmail,
  loginConMfa,
  register,
  solicitarReset,
  verificarMfa,
} from '../auth';

type Paso = 'clave' | 'mfa' | 'olvido' | 'reset';

export default function AuthView({ onAuth }: { onAuth: () => void }): React.ReactElement {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [paso, setPaso] = useState<Paso>('clave');
  const [email, setEmail] = useState(getEmail() ?? '');
  const [password, setPassword] = useState('');
  const [mfaToken, setMfaToken] = useState('');
  const [codigo, setCodigo] = useState('');
  const [usarRecuperacion, setUsarRecuperacion] = useState(false);
  const [tokenReset, setTokenReset] = useState('');
  const [nuevaClave, setNuevaClave] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  function describe(e: unknown, defecto: string): string {
    if (e instanceof AuthHttpError) {
      if (e.status === 401) return 'Credenciales o código incorrectos.';
      if (e.status === 409) return 'Ese correo ya está registrado. Inicia sesión.';
      if (e.status === 429) return 'Demasiados intentos. Espera un momento e inténtalo de nuevo.';
      return `No se pudo completar: ${e.message}`;
    }
    return (e as Error).message || defecto;
  }

  async function submitClave(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    if (loading) return;
    setError('');
    setNotice('');
    if (!email.includes('@')) {
      setError('Escribe un correo válido.');
      return;
    }
    if (password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres.');
      return;
    }
    setLoading(true);
    try {
      if (mode === 'login') {
        const r = await loginConMfa(email.trim(), password);
        if (r.mfa) {
          setMfaToken(r.mfaToken);
          setCodigo('');
          setUsarRecuperacion(false);
          setPaso('mfa');
          setNotice('Tu cuenta usa verificación en dos pasos. Escribe el código de tu app.');
        } else {
          onAuth();
        }
      } else {
        const msg = await register(email.trim(), password);
        setNotice(`${msg} Ahora inicia sesión.`);
        setMode('login');
        setPassword('');
      }
    } catch (err) {
      setError(describe(err, 'No se pudo iniciar sesión.'));
    } finally {
      setLoading(false);
    }
  }

  async function submitMfa(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    if (loading) return;
    setError('');
    setNotice('');
    if (!codigo.trim()) {
      setError(usarRecuperacion ? 'Pega un código de recuperación.' : 'Escribe el código de 6 dígitos.');
      return;
    }
    setLoading(true);
    try {
      await verificarMfa(mfaToken, codigo.trim(), email.trim());
      onAuth();
    } catch (err) {
      setError(describe(err, 'No se pudo verificar el segundo factor.'));
    } finally {
      setLoading(false);
    }
  }

  async function submitOlvido(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    if (loading) return;
    setError('');
    setNotice('');
    if (!email.includes('@')) {
      setError('Escribe un correo válido.');
      return;
    }
    setLoading(true);
    try {
      const msg = await solicitarReset(email.trim());
      setNotice(`${msg} En desarrollo, el token llega por correo o por el registro del servidor.`);
      setPaso('reset');
    } catch (err) {
      setError(describe(err, 'No se pudo solicitar el cambio.'));
    } finally {
      setLoading(false);
    }
  }

  async function submitReset(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    if (loading) return;
    setError('');
    setNotice('');
    if (!tokenReset.trim() || nuevaClave.length < 8) {
      setError('Pega el token y escribe una contraseña de al menos 8 caracteres.');
      return;
    }
    setLoading(true);
    try {
      const msg = await confirmarReset(tokenReset.trim(), nuevaClave);
      setNotice(`${msg} Ahora inicia sesión con la nueva contraseña.`);
      setPaso('clave');
      setPassword('');
      setTokenReset('');
      setNuevaClave('');
    } catch (err) {
      setError(describe(err, 'No se pudo restablecer la contraseña.'));
    } finally {
      setLoading(false);
    }
  }

  if (paso === 'mfa') {
    return (
      <div className="auth-wrap">
        <div className="auth-card">
          <h2>Segundo factor</h2>
          <p className="meta">
            {usarRecuperacion
              ? 'Usa uno de tus códigos de recuperación (un solo uso).'
              : 'Abre tu app autenticadora y escribe el código actual.'}
          </p>
          <form onSubmit={submitMfa}>
            <label>
              {usarRecuperacion ? 'Código de recuperación' : 'Código de 6 dígitos'}
              <input
                value={codigo}
                onChange={(e) => setCodigo(e.target.value)}
                placeholder={usarRecuperacion ? 'p. ej. XXXX-XXXX' : '123456'}
                autoComplete="one-time-code"
              />
            </label>
            {error && <p className="error" role="alert">{error}</p>}
            {notice && <p className="ok">{notice}</p>}
            <button type="submit" disabled={loading}>
              {loading ? 'Verificando…' : 'Verificar e ingresar'}
            </button>
          </form>
          <p className="meta">
            <button
              type="button"
              className="link"
              onClick={() => {
                setUsarRecuperacion(!usarRecuperacion);
                setCodigo('');
                setError('');
              }}
            >
              {usarRecuperacion ? 'Usar código de la app' : 'Usar un código de recuperación'}
            </button>
          </p>
          <p className="meta">
            <button
              type="button"
              className="link"
              onClick={() => {
                setPaso('clave');
                setError('');
                setNotice('');
              }}
            >
              Volver al inicio de sesión
            </button>
          </p>
        </div>
      </div>
    );
  }

  if (paso === 'olvido' || paso === 'reset') {
    return (
      <div className="auth-wrap">
        <div className="auth-card">
          <h2>Recuperar contraseña</h2>
          {paso === 'olvido' ? (
            <>
              <p className="meta">Te enviamos un token válido por 1 hora.</p>
              <form onSubmit={submitOlvido}>
                <label>
                  Correo
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tucorreo@ejemplo.co" />
                </label>
                {error && <p className="error" role="alert">{error}</p>}
                {notice && <p className="ok">{notice}</p>}
                <button type="submit" disabled={loading}>
                  {loading ? 'Enviando…' : 'Solicitar token'}
                </button>
              </form>
            </>
          ) : (
            <>
              <p className="meta">
                Pega el token que recibiste por correo (en desarrollo también queda en el registro
                del servidor) y elige una contraseña nueva.
              </p>
              <form onSubmit={submitReset}>
                <label>
                  Token
                  <input value={tokenReset} onChange={(e) => setTokenReset(e.target.value)} placeholder="Token de recuperación" />
                </label>
                <label>
                  Nueva contraseña
                  <input
                    type="password"
                    autoComplete="new-password"
                    value={nuevaClave}
                    onChange={(e) => setNuevaClave(e.target.value)}
                    placeholder="Mínimo 8 caracteres"
                  />
                </label>
                {error && <p className="error" role="alert">{error}</p>}
                {notice && <p className="ok">{notice}</p>}
                <button type="submit" disabled={loading}>
                  {loading ? 'Guardando…' : 'Restablecer contraseña'}
                </button>
              </form>
            </>
          )}
          <p className="meta">
            <button
              type="button"
              className="link"
              onClick={() => {
                setPaso('clave');
                setError('');
                setNotice('');
              }}
            >
              Volver al inicio de sesión
            </button>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <h2>{mode === 'login' ? 'Iniciar sesión' : 'Crear cuenta'}</h2>
        <p className="meta">Lex Colombia AI · tus chats quedan guardados por cuenta.</p>
        <form onSubmit={submitClave}>
          <label>
            Correo
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tucorreo@ejemplo.co"
            />
          </label>
          <label>
            Contraseña
            <input
              type="password"
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mínimo 8 caracteres"
            />
          </label>
          {error && <p className="error" role="alert">{error}</p>}
          {notice && <p className="ok">{notice}</p>}
          <button type="submit" disabled={loading}>
            {loading ? 'Espera…' : mode === 'login' ? 'Entrar' : 'Registrarme'}
          </button>
        </form>
        {mode === 'login' && (
          <p className="meta">
            <button
              type="button"
              className="link"
              onClick={() => {
                setPaso('olvido');
                setError('');
                setNotice('');
              }}
            >
              ¿Olvidaste tu contraseña?
            </button>
          </p>
        )}
        <p className="meta">
          {mode === 'login' ? '¿Sin cuenta? ' : '¿Ya tienes cuenta? '}
          <button
            type="button"
            className="link"
            onClick={() => {
              setMode(mode === 'login' ? 'register' : 'login');
              setError('');
              setNotice('');
            }}
          >
            {mode === 'login' ? 'Regístrate' : 'Inicia sesión'}
          </button>
        </p>
      </div>
    </div>
  );
}
