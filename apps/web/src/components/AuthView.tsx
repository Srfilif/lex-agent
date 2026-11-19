import { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import {
  AuthHttpError,
  confirmarReset,
  fetchAccessMode,
  getEmail,
  loginConMfa,
  register,
  solicitarReset,
  verificarMfa,
  type AccessModeState,
} from '../auth';
import { Alert, AlertDescription } from './ui/alert';
import { Button } from './ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from './ui/card';
import { Checkbox } from './ui/checkbox';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { PRIVACY_VERSION, TERMS_VERSION, URL_PRIVACIDAD, URL_TERMINOS } from '../legal';

type Paso = 'clave' | 'mfa' | 'olvido' | 'reset';
type ModoAuth = 'login' | 'register' | 'forgot' | 'reset';

function Avisos({ error, notice }: { error: string; notice: string }): React.ReactElement | null {
  if (!error && !notice) return null;
  return (
    <div className="space-y-2">
      {error && (
        <Alert variant="destructive" className="border-destructive/30 bg-destructive/5">
          <AlertCircle />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {notice && (
        <Alert className="border-primary/20 bg-primary/5">
          <CheckCircle2 className="text-primary" />
          <AlertDescription className="text-foreground">{notice}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}

function AuthCard({
  title,
  description,
  children,
}: {
  title: string;
  description: React.ReactNode;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <Card className="w-full max-w-[420px] gap-0 border-border py-0 shadow-[var(--shadow-3)]">
      <CardHeader className="gap-1.5 border-b border-border px-6 py-5">
        <CardTitle className="font-heading text-xl font-semibold">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="px-6 py-5">{children}</CardContent>
    </Card>
  );
}

export default function AuthView({
  modo,
  tokenInicial = '',
  onAuth,
  onNavegar,
}: {
  modo: ModoAuth;
  tokenInicial?: string;
  onAuth: () => void;
  onNavegar: (destino: string) => void;
}): React.ReactElement {
  const [mode, setMode] = useState<'login' | 'register'>(
    modo === 'register' ? 'register' : 'login',
  );
  const [paso, setPaso] = useState<Paso>(
    modo === 'forgot' ? 'olvido' : modo === 'reset' ? 'reset' : 'clave',
  );
  const [email, setEmail] = useState(getEmail() ?? '');
  const [password, setPassword] = useState('');
  const [mfaToken, setMfaToken] = useState('');
  const [codigo, setCodigo] = useState('');
  const [usarRecuperacion, setUsarRecuperacion] = useState(false);
  const [tokenReset, setTokenReset] = useState(tokenInicial);
  const [nuevaClave, setNuevaClave] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [aceptoTerminos, setAceptoTerminos] = useState(false);
  const [autorizoDatos, setAutorizoDatos] = useState(false);
  const [acceso, setAcceso] = useState<AccessModeState>({
    mode: 'public',
    code_required: false,
    whitelist_required: false,
  });
  const [codigoAcceso, setCodigoAcceso] = useState('');

  useEffect(() => {
    let vivo = true;
    fetchAccessMode()
      .then((a) => {
        if (vivo) setAcceso(a);
      })
      .catch(() => undefined);
    return () => {
      vivo = false;
    };
  }, []);

  // La URL es la fuente de verdad para login/registro/recuperación.
  useEffect(() => {
    if (modo === 'register') {
      setMode('register');
      setPaso('clave');
    } else if (modo === 'forgot') {
      setMode('login');
      setPaso('olvido');
    } else if (modo === 'reset') {
      setMode('login');
      setPaso('reset');
      setTokenReset(tokenInicial);
    } else {
      setMode('login');
      setPaso('clave');
    }
  }, [modo, tokenInicial]);

  function describe(e: unknown, defecto: string): string {
    if (e instanceof AuthHttpError) {
      if (e.status === 401) return 'Credenciales o código incorrectos.';
      if (e.status === 403) return e.message || 'Acceso denegado por el modo de la plataforma.';
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
        if (acceso.mode === 'maintenance') {
          setError('Plataforma en mantenimiento: solo administradores.');
          setLoading(false);
          return;
        }
        if (acceso.mode === 'closed') {
          setError('El registro está cerrado por el momento.');
          setLoading(false);
          return;
        }
        if (acceso.code_required && !codigoAcceso.trim()) {
          setError('Escribe tu código de acceso.');
          setLoading(false);
          return;
        }
        if (!aceptoTerminos || !autorizoDatos) {
          setError('Marca ambas casillas: términos y autorización de datos son independientes.');
          setLoading(false);
          return;
        }
        const msg = await register(
          email.trim(),
          password,
          {
            termsAccepted: aceptoTerminos,
            privacyAccepted: autorizoDatos,
          },
          acceso.code_required ? codigoAcceso : undefined,
        );
        setNotice(`${msg} Ahora inicia sesión.`);
        setMode('login');
        setPassword('');
        setAceptoTerminos(false);
        setAutorizoDatos(false);
        setCodigoAcceso('');
        onNavegar('/login');
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
      onNavegar('/reset-password');
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
      onNavegar('/login');
    } catch (err) {
      setError(describe(err, 'No se pudo restablecer la contraseña.'));
    } finally {
      setLoading(false);
    }
  }

  if (paso === 'mfa') {
    return (
      <div className="auth-wrap">
        <AuthCard
          title="Segundo factor"
          description={
            usarRecuperacion
              ? 'Usa uno de tus códigos de recuperación (un solo uso).'
              : 'Abre tu app autenticadora y escribe el código actual.'
          }
        >
          <form className="space-y-4" onSubmit={submitMfa}>
            <div className="space-y-1.5">
              <Label htmlFor="auth-mfa-code">
                {usarRecuperacion ? 'Código de recuperación' : 'Código de 6 dígitos'}
              </Label>
              <Input
                id="auth-mfa-code"
                className="h-10"
                value={codigo}
                onChange={(e) => setCodigo(e.target.value)}
                placeholder={usarRecuperacion ? 'p. ej. XXXX-XXXX' : '123456'}
                autoComplete="one-time-code"
              />
            </div>
            <Avisos error={error} notice={notice} />
            <Button type="submit" size="lg" className="h-10 w-full" disabled={loading}>
              {loading && <Loader2 className="animate-spin" />}
              {loading ? 'Verificando…' : 'Verificar e ingresar'}
            </Button>
          </form>
          <div className="mt-4 flex flex-wrap justify-between gap-2 border-t border-border pt-4">
            <Button
              type="button"
              variant="link"
              size="sm"
              className="h-auto p-0 text-xs"
              onClick={() => {
                setUsarRecuperacion(!usarRecuperacion);
                setCodigo('');
                setError('');
              }}
            >
              {usarRecuperacion ? 'Usar código de la app' : 'Usar un código de recuperación'}
            </Button>
            <Button
              type="button"
              variant="link"
              size="sm"
              className="h-auto p-0 text-xs"
              onClick={() => {
                setPaso('clave');
                setError('');
                setNotice('');
                onNavegar('/login');
              }}
            >
              Volver al inicio de sesión
            </Button>
          </div>
        </AuthCard>
      </div>
    );
  }

  if (paso === 'olvido' || paso === 'reset') {
    return (
      <div className="auth-wrap">
        <AuthCard
          title="Recuperar contraseña"
          description={
            paso === 'olvido'
              ? 'Te enviamos un token válido por 1 hora.'
              : 'Pega el token que recibiste por correo y elige una contraseña nueva.'
          }
        >
          {paso === 'olvido' ? (
            <form className="space-y-4" onSubmit={submitOlvido}>
              <div className="space-y-1.5">
                <Label htmlFor="auth-recovery-email">Correo</Label>
                <Input
                  id="auth-recovery-email"
                  className="h-10"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="tucorreo@ejemplo.co"
                />
              </div>
              <Avisos error={error} notice={notice} />
              <Button type="submit" size="lg" className="h-10 w-full" disabled={loading}>
                {loading && <Loader2 className="animate-spin" />}
                {loading ? 'Enviando…' : 'Solicitar token'}
              </Button>
            </form>
          ) : (
            <form className="space-y-4" onSubmit={submitReset}>
              <div className="space-y-1.5">
                <Label htmlFor="auth-reset-token">Token</Label>
                <Input
                  id="auth-reset-token"
                  className="h-10"
                  value={tokenReset}
                  onChange={(e) => setTokenReset(e.target.value)}
                  placeholder="Token de recuperación"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="auth-reset-password">Nueva contraseña</Label>
                <Input
                  id="auth-reset-password"
                  className="h-10"
                  type="password"
                  autoComplete="new-password"
                  value={nuevaClave}
                  onChange={(e) => setNuevaClave(e.target.value)}
                  placeholder="Mínimo 8 caracteres"
                />
              </div>
              <Avisos error={error} notice={notice} />
              <Button type="submit" size="lg" className="h-10 w-full" disabled={loading}>
                {loading && <Loader2 className="animate-spin" />}
                {loading ? 'Guardando…' : 'Restablecer contraseña'}
              </Button>
            </form>
          )}
          <div className="mt-4 border-t border-border pt-4">
            <Button
              type="button"
              variant="link"
              size="sm"
              className="h-auto p-0 text-xs"
              onClick={() => {
                setPaso('clave');
                setError('');
                setNotice('');
                onNavegar('/login');
              }}
            >
              Volver al inicio de sesión
            </Button>
          </div>
        </AuthCard>
      </div>
    );
  }

  return (
    <div className="auth-wrap">
      <AuthCard
        title={mode === 'login' ? 'Iniciar sesión' : 'Crear cuenta'}
        description="Kelsyx · tus chats quedan guardados por cuenta."
      >
        <form className="space-y-4" onSubmit={submitClave}>
          <div className="space-y-1.5">
            <Label htmlFor="auth-email">Correo</Label>
            <Input
              id="auth-email"
              className="h-10"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tucorreo@ejemplo.co"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="auth-password">Contraseña</Label>
            <Input
              id="auth-password"
              className="h-10"
              type="password"
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mínimo 8 caracteres"
            />
          </div>
          {acceso.mode === 'maintenance' && (
            <Alert className="border-primary/20 bg-primary/5">
              <AlertDescription className="text-foreground">
                Plataforma en mantenimiento: solo administradores pueden entrar.
              </AlertDescription>
            </Alert>
          )}
          {mode === 'register' && acceso.mode === 'closed' && (
            <Alert className="border-primary/20 bg-primary/5">
              <AlertDescription className="text-foreground">
                El registro está cerrado por el momento. Si ya tienes cuenta, inicia sesión.
              </AlertDescription>
            </Alert>
          )}
          {mode === 'register' && acceso.whitelist_required && (
            <p className="meta" style={{ fontSize: 'var(--text-xs)' }}>
              Registro solo para correos autorizados. Si tu correo no está en la lista, pide
              acceso al administrador.
            </p>
          )}
          {mode === 'register' && acceso.code_required && (
            <div className="space-y-1.5">
              <Label htmlFor="auth-access-code">Código de acceso</Label>
              <Input
                id="auth-access-code"
                className="h-10"
                type="text"
                autoComplete="off"
                value={codigoAcceso}
                onChange={(e) => setCodigoAcceso(e.target.value)}
                placeholder="XXXX-XXXX-XXXX"
              />
            </div>
          )}
          {mode === 'register' && (
            <div className="space-y-2.5">
              <label className="check flex items-start gap-2 text-xs">
                <Checkbox
                  checked={aceptoTerminos}
                  onCheckedChange={(c) => setAceptoTerminos(c === true)}
                />
                <span>
                  Acepto los{' '}
                  <a href={URL_TERMINOS} target="_blank" rel="noreferrer">
                    Términos del Servicio (v{TERMS_VERSION})
                  </a>
                </span>
              </label>
              <label className="check flex items-start gap-2 text-xs">
                <Checkbox
                  checked={autorizoDatos}
                  onCheckedChange={(c) => setAutorizoDatos(c === true)}
                />
                <span>
                  Autorizo el tratamiento de mis datos según la{' '}
                  <a href={URL_PRIVACIDAD} target="_blank" rel="noreferrer">
                    Política de Datos (v{PRIVACY_VERSION})
                  </a>
                </span>
              </label>
            </div>
          )}
          <Avisos error={error} notice={notice} />
          <Button
            type="submit"
            size="lg"
            className="h-10 w-full"
            disabled={
              loading ||
              (mode === 'register' &&
                (acceso.mode === 'closed' || acceso.mode === 'maintenance'))
            }
          >
            {loading && <Loader2 className="animate-spin" />}
            {loading ? 'Espera…' : mode === 'login' ? 'Entrar' : 'Registrarme'}
          </Button>
        </form>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-4 text-xs text-muted-foreground">
          {mode === 'login' ? (
            <Button
              type="button"
              variant="link"
              size="sm"
              className="h-auto p-0 text-xs"
              onClick={() => {
                setPaso('olvido');
                setError('');
                setNotice('');
                onNavegar('/forgot-password');
              }}
            >
              ¿Olvidaste tu contraseña?
            </Button>
          ) : (
            <span />
          )}
          <span>
            {mode === 'login' ? '¿Sin cuenta? ' : '¿Ya tienes cuenta? '}
            <Button
              type="button"
              variant="link"
              size="sm"
              className="h-auto p-0 text-xs"
              onClick={() => {
                const siguiente = mode === 'login' ? 'register' : 'login';
                setMode(siguiente);
                setError('');
                setNotice('');
                onNavegar(siguiente === 'register' ? '/register' : '/login');
              }}
            >
              {mode === 'login' ? 'Regístrate' : 'Inicia sesión'}
            </Button>
          </span>
        </div>
      </AuthCard>
    </div>
  );
}
