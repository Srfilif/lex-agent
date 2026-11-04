import { useEffect, useState } from 'react';
import { clearSession, getEmail, isLoggedIn, logout } from './auth';
import { fetchMe, fetchPreferencias, type Me, type Preferencias } from './cuenta';
import AuthView from './components/AuthView';
import ChatShell from './components/ChatShell';
import CorpusFooter from './components/CorpusFooter';
import Cuenta from './components/Cuenta';
import { aplicarTema } from './shared/tema';
import Investigar from './components/Investigar';
import SharedView, { leerTokenCompartido } from './components/SharedView';
import Storage from './components/Storage';

type Vista = 'chat' | 'investigar' | 'cuenta' | 'storage';

// Mini-router por hash (sin dependencias): #/chat, #/investigar, #/cuenta,
// #/storage y alias #/settings/storage. Sin hash → chat.
function vistaDeHash(): Vista {
  const h = window.location.hash.replace(/^#/, '');
  if (h === '/storage' || h === '/settings/storage') return 'storage';
  if (h === '/investigar') return 'investigar';
  if (h === '/cuenta') return 'cuenta';
  return 'chat';
}

export default function App(): React.ReactElement {
  // B9: enlace público compartido (?share=TOKEN o #/s/TOKEN): se muestra sin login.
  const [shareToken] = useState<string | null>(() => leerTokenCompartido());
  const [authed, setAuthed] = useState(isLoggedIn());
  const [vista, setVistaState] = useState<Vista>('chat');
  function setVista(v: Vista): void {
    setVistaState(v);
    const h = v === 'chat' ? '#/chat' : `#/${v}`;
    if (window.location.hash !== h) window.location.hash = h;
  }
  const [email, setEmail] = useState(getEmail());
  const [me, setMe] = useState<Me | null>(null);
  const [prefs, setPrefs] = useState<Preferencias | null>(null);
  // Investigar es público (legado): se puede usar sin cuenta.
  const [invitado, setInvitado] = useState(false);

  useEffect(() => {
    const onExpired = (): void => {
      clearSession();
      setAuthed(false);
      setMe(null);
    };
    window.addEventListener('lex:session-expired', onExpired);
    return () => window.removeEventListener('lex:session-expired', onExpired);
  }, []);

  // Sincronizar vista con el hash (deep-link + botón atrás).
  useEffect(() => {
    if (!shareToken) setVistaState(vistaDeHash());
    const onHash = (): void => {
      if (!shareToken) setVistaState(vistaDeHash());
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shareToken]);

  // Al cambiar de vista, llevar el foco al contenido (lectores de pantalla).
  useEffect(() => {
    if (authed && !shareToken) document.getElementById('contenido')?.focus({ preventScroll: true });
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
          aplicarTema(p.theme);
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
    setInvitado(false);
    setVista('chat');
  }

  function sesionCerrada(): void {
    setAuthed(false);
    setEmail(null);
    setMe(null);
    setVista('chat');
  }

  if (shareToken) {
    return (
      <>
        <header>
          <div>
            <h1>Lex Colombia AI</h1>
            <p>Conversación compartida · No es asesoría jurídica.</p>
          </div>
        </header>
        <SharedView token={shareToken} />
        <footer>
          <p>Vigencia normativa no verificada · Verifique las fuentes antes de actuar.</p>
        </footer>
      </>
    );
  }

  if (!authed && !invitado) {
    return (
      <>
        <header>
          <div>
            <h1>Lex Colombia AI</h1>
            <p>Investigación jurídica con citas verificables. No es asesoría jurídica.</p>
          </div>
        </header>
        <AuthView
          onAuth={() => {
            setAuthed(true);
            setEmail(getEmail());
          }}
        />
        <p className="meta centro">
          <button type="button" className="link" onClick={() => setInvitado(true)}>
            Continuar sin cuenta (solo Investigar)
          </button>
        </p>
        <CorpusFooter />
      </>
    );
  }

  if (!authed) {
    return (
      <>
        <header>
          <div>
            <h1>Lex Colombia AI</h1>
            <p>Investigación jurídica con citas verificables. No es asesoría jurídica.</p>
          </div>
          <nav className="topnav">
            <span className="meta">Modo invitado</span>
            <button type="button" className="secundario" onClick={() => setInvitado(false)}>
              Iniciar sesión
            </button>
          </nav>
        </header>
        <Investigar />
        <CorpusFooter />
      </>
    );
  }

  return (
    <>
      <a
        className="skip-link"
        href="#contenido"
        onClick={(e) => {
          e.preventDefault(); // no ensuciar el hash-router
          document.getElementById('contenido')?.focus();
        }}
      >
        Saltar al contenido
      </a>
      <header>
        <div>
          <h1>Lex Colombia AI</h1>
          <p>Investigación jurídica con citas verificables. No es asesoría jurídica.</p>
        </div>
        <nav className="topnav" aria-label="Principal">
          <button
            type="button"
            className={vista === 'chat' ? 'activo' : ''}
            onClick={() => setVista('chat')}
          >
            Chat
          </button>
          <button
            type="button"
            className={vista === 'investigar' ? 'activo' : ''}
            onClick={() => setVista('investigar')}
          >
            Investigar
          </button>
          <button
            type="button"
            className={vista === 'cuenta' ? 'activo' : ''}
            onClick={() => setVista('cuenta')}
          >
            Cuenta
          </button>
          <button
            type="button"
            className={vista === 'storage' ? 'activo' : ''}
            onClick={() => setVista('storage')}
          >
            Archivos
          </button>
          <span className="meta">{me?.email ?? email}</span>
          <button type="button" className="secundario" onClick={() => void salir()}>
            Salir
          </button>
        </nav>
      </header>
      <main id="contenido" tabIndex={-1}>
        {vista === 'chat' && <ChatShell modeloPreferido={prefs?.ai.model} />}
        {vista === 'investigar' && <Investigar />}
        {vista === 'storage' && <Storage />}
        {vista === 'cuenta' &&
          (me ? (
            <Cuenta me={me} onMe={setMe} onPrefs={setPrefs} onSesionCerrada={sesionCerrada} />
          ) : (
            <p className="meta centro">Cargando tu cuenta…</p>
          ))}
      </main>
      <CorpusFooter />
    </>
  );
}
