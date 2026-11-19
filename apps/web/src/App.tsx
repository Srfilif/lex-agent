import { useEffect, useMemo, useState } from 'react';
import { Moon, Scale, ShieldCheck, Sparkles, Sun } from 'lucide-react';
import { clearSession, fetchAccessMode, getEmail, isLoggedIn, logout } from './auth';
import {
  fetchConsentimientos,
  fetchMe,
  fetchPreferencias,
  patchPreferencias,
  type ConsentState,
  type Me,
  type Preferencias,
} from './cuenta';
import AuthView from './components/AuthView';
import AppShell, { type Vista } from './components/AppShell';
import Biblioteca from './components/Biblioteca';
import { Brand } from './components/Logo';
import ChatShell from './components/ChatShell';
import ConsentGate from './components/ConsentGate';
import CookieNotice from './components/CookieNotice';
import CorpusFooter from './components/CorpusFooter';
import Cuenta, { type SubVista } from './components/Cuenta';
import Dashboard from './components/Dashboard';
import Investigar from './components/Investigar';
import SharedView, { leerTokenCompartido } from './components/SharedView';
import Storage from './components/Storage';
import { Button } from './components/ui/button';
import { aplicarTema } from './shared/tema';
import { puedeGuardarTema, URL_PRIVACIDAD, URL_TERMINOS } from './legal';

// Mini-router con History API (sin dependencias): /login, /register,
// /forgot-password, /reset-password, /inicio, /chat, /investigar,
// /biblioteca, /storage, /cuenta, /admin y /s/:token (compartido).
const RUTA_POR_VISTA: Record<Vista, string> = {
  inicio: '/inicio',
  chat: '/chat',
  investigar: '/investigar',
  biblioteca: '/biblioteca',
  storage: '/storage',
  cuenta: '/cuenta',
  admin: '/admin',
};

const VISTA_POR_RUTA: Record<string, Vista> = {
  '/inicio': 'inicio',
  '/chat': 'chat',
  '/investigar': 'investigar',
  '/biblioteca': 'biblioteca',
  '/storage': 'storage',
  '/settings/storage': 'storage',
  '/cuenta': 'cuenta',
  '/admin': 'admin',
};

type ModoAuth = 'login' | 'register' | 'forgot' | 'reset';

interface RutaAuth {
  modo: ModoAuth;
  next: string | null;
  token: string | null;
}

function rutaActual(): string {
  return `${window.location.pathname}${window.location.search}`;
}

/** Normaliza enlaces heredados con hash o ?share= a rutas reales. */
function normalizarRutaInicial(): string {
  const hash = window.location.hash.replace(/^#/, '').replace(/\/+$/, '');
  const compartido = hash.match(/^\/s\/([A-Za-z0-9_-]+)$/);
  let destino: string | null = null;
  if (compartido) {
    destino = `/s/${compartido[1]}`;
  } else if (hash === '/settings/storage') {
    destino = '/storage';
  } else if (hash && !hash.startsWith('/s/') && VISTA_POR_RUTA[hash]) {
    destino = hash;
  } else if (
    hash === '/login' ||
    hash === '/register' ||
    hash === '/forgot-password' ||
    hash === '/reset-password'
  ) {
    destino = hash;
  }
  if (!destino) {
    const token = new URLSearchParams(window.location.search).get('share');
    if (token?.trim()) destino = `/s/${encodeURIComponent(token.trim())}`;
  }
  if (destino) {
    window.history.replaceState({}, '', destino);
    return destino;
  }
  return rutaActual();
}

function pathDeRuta(ruta: string): string {
  const path = new URL(ruta, window.location.origin).pathname;
  return path.replace(/\/+$/, '') || '/';
}

function vistaDeRuta(ruta: string): Vista | null {
  return VISTA_POR_RUTA[pathDeRuta(ruta)] ?? null;
}

function nextSeguro(next: string | null): string | null {
  if (!next || !next.startsWith('/') || next.startsWith('//')) return null;
  return next;
}

function authDeRuta(ruta: string): RutaAuth | null {
  const url = new URL(ruta, window.location.origin);
  const path = pathDeRuta(ruta);
  const next = nextSeguro(url.searchParams.get('next'));
  if (path === '/login') return { modo: 'login', next, token: null };
  if (path === '/register') return { modo: 'register', next, token: null };
  if (path === '/forgot-password') return { modo: 'forgot', next, token: null };
  const tokenPath = path.match(/^\/reset-password\/([^/]+)$/);
  if (tokenPath) {
    return { modo: 'reset', next, token: decodeURIComponent(tokenPath[1]) };
  }
  if (path === '/reset-password') {
    return { modo: 'reset', next, token: url.searchParams.get('token') ?? '' };
  }
  return null;
}

export default function App(): React.ReactElement {
  const [ruta, setRuta] = useState(normalizarRutaInicial);
  const [authed, setAuthed] = useState(isLoggedIn());
  const [email, setEmail] = useState(getEmail());
  const [me, setMe] = useState<Me | null>(null);
  const [prefs, setPrefs] = useState<Preferencias | null>(null);
  // Investigar es público (legado): se puede usar sin cuenta.
  const [invitado, setInvitado] = useState(false);

  // Semilla del asistente: un texto inicial y/o un chat a abrir.
  const [chatSeed, setChatSeed] = useState<{ texto: string; nonce: number } | null>(null);
  const [chatTarget, setChatTarget] = useState<string | null>(null);
  const [chatNonce, setChatNonce] = useState(0);
  const [cuentaTab, setCuentaTab] = useState<SubVista>('perfil');

  const [temaLocal, setTemaLocal] = useState<'light' | 'dark' | 'system'>(() => {
    if (!puedeGuardarTema()) return 'system'; // rechazó lo opcional: sin persistencia
    const guardado = localStorage.getItem('lex_theme');
    return guardado === 'light' || guardado === 'dark' || guardado === 'system'
      ? guardado
      : 'system';
  });
  const [consentimientos, setConsentimientos] = useState<ConsentState | null>(null);
  const [accesoAbierto, setAccesoAbierto] = useState(true);

  // Entrada de invitado solo en modo abierto (el servidor decide; esto es UI).
  useEffect(() => {
    if (authed) return;
    let vivo = true;
    fetchAccessMode()
      .then((a) => {
        if (vivo) setAccesoAbierto(a.mode === 'public');
      })
      .catch(() => undefined);
    return () => {
      vivo = false;
    };
  }, [authed]);
  const [oscuroSistema, setOscuroSistema] = useState(
    () => window.matchMedia('(prefers-color-scheme: dark)').matches,
  );

  const temaEfectivo = usoEfectivo(temaLocal, oscuroSistema);
  const shareToken = leerTokenCompartido(ruta);
  const authRuta = authDeRuta(ruta);
  const vistaRuta = vistaDeRuta(ruta);
  const vista = vistaRuta ?? 'inicio';

  function navegar(destino: string, reemplazar = false): void {
    const actual = rutaActual();
    if (actual === destino) return;
    window.history[reemplazar ? 'replaceState' : 'pushState']({}, '', destino);
    setRuta(rutaActual());
  }

  function setVista(v: Vista): void {
    navegar(RUTA_POR_VISTA[v]);
  }

  function abrirCuenta(tab: SubVista = 'perfil'): void {
    setCuentaTab(tab);
    setVista('cuenta');
  }

  function navegarAuth(destino: string): void {
    const next = authRuta?.next;
    if (!next) {
      navegar(destino);
      return;
    }
    const separador = destino.includes('?') ? '&' : '?';
    navegar(`${destino}${separador}next=${encodeURIComponent(next)}`);
  }

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = (e: MediaQueryListEvent): void => setOscuroSistema(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    aplicarTema(temaLocal);
    if (puedeGuardarTema()) localStorage.setItem('lex_theme', temaLocal);
  }, [temaLocal]);

  useEffect(() => {
    const onExpired = (): void => {
      clearSession();
      setAuthed(false);
      setMe(null);
      setConsentimientos(null);
    };
    window.addEventListener('lex:session-expired', onExpired);
    return () => window.removeEventListener('lex:session-expired', onExpired);
  }, []);

  // Atrás/adelante del navegador y enlaces directos.
  useEffect(() => {
    const onPop = (): void => setRuta(rutaActual());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  // Guardas de ruta: raíz, sesión y acceso al área privada.
  useEffect(() => {
    if (leerTokenCompartido(ruta)) return;
    const auth = authDeRuta(ruta);
    const v = vistaDeRuta(ruta);
    if (!auth && !v) {
      navegar(authed ? '/inicio' : '/login', true);
      return;
    }
    if (authed && auth) {
      navegar(auth.next ?? '/inicio', true);
      return;
    }
    if (!authed && !invitado && v) {
      navegar(`/login?next=${encodeURIComponent(ruta)}`, true);
      return;
    }
    if (!authed && invitado && v && v !== 'investigar') {
      setInvitado(false);
      navegar(`/login?next=${encodeURIComponent(ruta)}`, true);
    }
  }, [ruta, authed, invitado]);

  // Al cambiar de vista, volver arriba y llevar el foco al contenido.
  useEffect(() => {
    if (!authed || shareToken) return;
    window.scrollTo({ top: 0, left: 0 });
    document.getElementById('contenido')?.focus({ preventScroll: true });
  }, [vista, authed, shareToken]);

  // Tras login: cargar GET /account/me una vez y aplicar el tema guardado.
  useEffect(() => {
    if (!authed || me) return;
    let vivo = true;
    fetchMe()
      .then((m) => {
        if (vivo) {
          setMe(m);
          setEmail(m.email);
        }
      })
      .catch(() => undefined);
    fetchPreferencias()
      .then((p) => {
        if (vivo) {
          setPrefs(p);
          if (p.theme === 'light' || p.theme === 'dark') setTemaLocal(p.theme);
          else aplicarTema(p.theme);
        }
      })
      .catch(() => undefined);
    return () => {
      vivo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authed]);

  async function salir(): Promise<void> {
    await logout();
    setAuthed(false);
    setEmail(null);
    setMe(null);
    setPrefs(null);
    setConsentimientos(null);
    setInvitado(false);
    navegar('/login', true);
  }

  function sesionCerrada(): void {
    setAuthed(false);
    setEmail(null);
    setMe(null);
    setConsentimientos(null);
    navegar('/login', true);
  }

  const faltaConsentimiento =
    me !== null && (me.terms_version === null || me.privacy_version === null);

  // Cuentas previas a la migración 019: cargar estado para la puerta.
  useEffect(() => {
    if (!authed || !faltaConsentimiento || consentimientos) return;
    let vivo = true;
    fetchConsentimientos()
      .then((c) => {
        if (vivo) setConsentimientos(c);
      })
      .catch(() => undefined);
    return () => {
      vivo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authed, faltaConsentimiento]);

  function preguntar(texto: string): void {
    setChatTarget(null);
    setChatSeed({ texto, nonce: Date.now() });
    setChatNonce((n) => n + 1);
    setVista('chat');
  }

  function nuevoChat(): void {
    setChatSeed(null);
    setChatTarget(null);
    setChatNonce((n) => n + 1);
    setVista('chat');
  }

  function abrirChat(id: string): void {
    setChatSeed(null);
    setChatTarget(id);
    setChatNonce((n) => n + 1);
    setVista('chat');
  }

  function alternarTema(): void {
    const siguiente = temaEfectivo === 'dark' ? 'light' : 'dark';
    setTemaLocal(siguiente);
    if (authed) void patchPreferencias({ theme: siguiente }).catch(() => undefined);
  }

  const chatKey = useMemo(() => `${chatNonce}-${chatTarget ?? ''}`, [chatNonce, chatTarget]);

  if (shareToken) {
    // /s/:token o el formato heredado ?share=TOKEN: sin login.
    return (
      <div className="public-shell">
        <header className="public-header">
          <div className="brand" style={{ padding: 0 }}>
            <Brand />
          </div>
          <span className="chip">Conversación compartida</span>
        </header>
        <SharedView token={shareToken} />
        <footer>
          <p>
            Vigencia normativa no verificada · Verifique las fuentes antes de actuar. No es
            asesoría jurídica.{' '}
            <a href={URL_TERMINOS} target="_blank" rel="noreferrer">
              Términos
            </a>{' '}
            ·{' '}
            <a href={URL_PRIVACIDAD} target="_blank" rel="noreferrer">
              Privacidad
            </a>
          </p>
        </footer>
        <CookieNotice />
      </div>
    );
  }

  if (!authed && !(invitado && vista === 'investigar')) {
    return (
      <div className="auth-page">
        <aside className="auth-aside" aria-hidden="true">
          <div className="brand">
            <Brand />
          </div>
          <div>
            <span className="eyebrow" style={{ color: '#d4b378' }}>
              <Scale size={13} /> Investigación jurídica
            </span>
            <h1>Respuestas fundamentadas en el ordenamiento jurídico colombiano.</h1>
            <p>
              Un espacio de trabajo para consultar normas, jurisprudencia y documentos con
              trazabilidad documental en cada respuesta.
            </p>
            <ul className="auth-points">
              <li>
                <ShieldCheck size={16} /> Citas verificables al fragmento exacto de la fuente.
              </li>
              <li>
                <Sparkles size={16} /> Investigación multi-turno con contexto de tu caso.
              </li>
              <li>
                <Scale size={16} /> Separación explícita entre fuente, análisis e interpretación.
              </li>
            </ul>
          </div>
          <p style={{ fontSize: '0.72rem', color: '#8fa39a' }}>
            Herramienta de apoyo a la investigación. No sustituye el criterio profesional ni
            constituye asesoría jurídica.
          </p>
        </aside>
        <section className="auth-main">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="auth-theme size-9"
            onClick={alternarTema}
            aria-label={temaEfectivo === 'dark' ? 'Activar tema claro' : 'Activar tema oscuro'}
            title={temaEfectivo === 'dark' ? 'Tema claro' : 'Tema oscuro'}
          >
            {temaEfectivo === 'dark' ? <Sun /> : <Moon />}
          </Button>
          <div className="auth-mobile-brand">
            <Brand />
          </div>
          <AuthView
            modo={authRuta?.modo ?? 'login'}
            tokenInicial={authRuta?.token ?? ''}
            onNavegar={navegarAuth}
            onAuth={() => {
              setAuthed(true);
              setEmail(getEmail());
              navegar(authRuta?.next ?? '/inicio', true);
            }}
          />
          {accesoAbierto && (
            <p className="guest-link">
              <Button
                type="button"
                variant="link"
                size="sm"
                className="h-auto p-0 text-xs"
                onClick={() => {
                  setInvitado(true);
                  navegar('/investigar');
                }}
              >
                Continuar sin cuenta (solo Investigación)
              </Button>
            </p>
          )}
          <p className="auth-legal">
            Al continuar aceptas que las respuestas deben validarse con las fuentes oficiales. La
            vigencia normativa no está garantizada.{' '}
            <a href={URL_TERMINOS} target="_blank" rel="noreferrer">
              Términos
            </a>{' '}
            ·{' '}
            <a href={URL_PRIVACIDAD} target="_blank" rel="noreferrer">
              Privacidad
            </a>
          </p>
        </section>
        <CookieNotice />
      </div>
    );
  }

  if (!authed) {
    return (
      <div className="app" style={{ gridTemplateColumns: 'minmax(0, 1fr)' }}>
        <div className="app-body">
          <header className="topbar">
            <div className="topbar-left">
              <div className="brand" style={{ padding: 0 }}>
                <Brand />
              </div>
            </div>
            <div className="topbar-right">
              <span className="chip">Modo invitado</span>
              <button
                type="button"
                className="secundario"
                onClick={() => {
                  setInvitado(false);
                  navegar('/login');
                }}
              >
                Iniciar sesión
              </button>
            </div>
          </header>
          <main id="contenido" tabIndex={-1} style={{ flex: 1 }}>
            <Investigar />
          </main>
          <CorpusFooter />
        </div>
        <CookieNotice />
      </div>
    );
  }

  if (faltaConsentimiento) {
    return (
      <div className="app" style={{ gridTemplateColumns: 'minmax(0, 1fr)' }}>
        {consentimientos ? (
          <ConsentGate
            estado={consentimientos}
            onAceptado={() => {
              setConsentimientos(null);
              fetchMe()
                .then((m) => {
                  setMe(m);
                  setEmail(m.email);
                })
                .catch(() => undefined);
            }}
            onSalir={() => void salir()}
          />
        ) : (
          <div className="page">
            <div className="skeleton" style={{ height: 120 }} />
          </div>
        )}
        <CookieNotice />
      </div>
    );
  }

  return (
    <>
      <a
        className="skip-link"
        href="#contenido"
        onClick={(e) => {
          e.preventDefault(); // no cambia la ruta
          document.getElementById('contenido')?.focus();
        }}
      >
        Saltar al contenido
      </a>
      <AppShell
        vista={vista}
        onVista={setVista}
        me={me}
        email={email}
        theme={temaEfectivo}
        onToggleTheme={alternarTema}
        onLogout={() => void salir()}
        onNewChat={nuevoChat}
        onOpenChat={abrirChat}
        onCuenta={abrirCuenta}
      >
        {vista === 'inicio' && (
          <Dashboard me={me} onAsk={preguntar} onNav={setVista} onOpenChat={abrirChat} />
        )}
        {vista === 'chat' && (
          <ChatShell
            key={chatKey}
            modeloPreferido={prefs?.ai.model}
            borradorInicial={chatSeed?.texto ?? ''}
            conversacionInicial={chatTarget}
          />
        )}
        {vista === 'investigar' && <Investigar />}
        {vista === 'biblioteca' && <Biblioteca />}
        {vista === 'storage' && <Storage />}
        {vista === 'cuenta' &&
          (me ? (
            <Cuenta
              key={cuentaTab}
              me={me}
              onMe={setMe}
              onPrefs={setPrefs}
              onSesionCerrada={sesionCerrada}
              tabInicial={cuentaTab}
            />
          ) : (
            <div className="page">
              <div className="skeleton" style={{ height: 120 }} />
            </div>
          ))}
        {vista === 'admin' &&
          (me?.role === 'admin' ? (
            <Cuenta me={me} onMe={setMe} onPrefs={setPrefs} onSesionCerrada={sesionCerrada} tabInicial="admin" />
          ) : (
            <div className="page">
              <div className="empty-state">
                <strong>Sin permiso</strong>
                <p>La administración está disponible solo para cuentas con rol de administrador.</p>
              </div>
            </div>
          ))}
      </AppShell>
      <CookieNotice />
    </>
  );
}

/** Tema efectivo: 'system' se resuelve contra la preferencia del sistema. */
function usoEfectivo(
  tema: 'light' | 'dark' | 'system',
  oscuroSistema: boolean,
): 'light' | 'dark' {
  if (tema === 'system') return oscuroSistema ? 'dark' : 'light';
  return tema;
}
