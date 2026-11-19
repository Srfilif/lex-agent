import type { Metadata } from 'next';
import Link from 'next/link';
import { ReabrirCookies } from '../CookieNotice';
import { Brand } from '../Logo';
import s from '../landing.module.css';

export const metadata: Metadata = {
  title: 'Política de Cookies',
  description:
    'Cookies y almacenamiento local de Kelsyx: solo técnicos necesarios y preferencia opcional de tema, sin analítica ni terceros.',
  alternates: {
    canonical: '/cookies',
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function CookiesPage() {
  return (
    <main className={s.legalPage} id="contenido">
      <header className={s.legalHeader}>
        <Brand />
        <h1 className={s.legalTitle}>Política de Cookies y Almacenamiento Local</h1>
        <p className={s.legalMeta}>Versión v1.0 · 18 de noviembre de 2026</p>
      </header>

      <div className={s.legalBody}>
        <section className={s.legalSection}>
          <h2>Lo esencial</h2>
          <p>
            No usamos cookies de analítica, publicidad ni seguimiento de terceros.
            Solo almacenamiento técnico necesario y una preferencia opcional de
            tema. El aviso de esta página cumple realmente su elección: rechazar
            borra la preferencia de tema e impide guardarla.
          </p>
        </section>

        <section className={s.legalSection}>
          <h2>1. Cookie de sesión (app)</h2>
          <p>
            <code>lex_refresh</code>: cookie HTTP HttpOnly, Secure en producción,
            SameSite=Lax, ruta /auth. Mantiene su sesión. Se elimina al cerrar
            sesión. Estrictamente necesaria.
          </p>
        </section>

        <section className={s.legalSection}>
          <h2>2. Almacenamiento local</h2>
          <p>
            App: tokens de sesión (<code>lex_access_token</code>,{' '}
            <code>lex_refresh_token</code>), correo (<code>lex_user_email</code>) y
            elección del aviso (<code>lex_cookie_choice</code>), necesarios; tema
            (<code>lex_theme</code>), opcional. Landing: solo tema y elección del
            aviso. Sin sessionStorage ni identificadores publicitarios.
          </p>
        </section>

        <section className={s.legalSection}>
          <h2>3. Su control</h2>
          <p>
            Rechazar lo opcional borra el tema guardado y activa el opt-out (tema
            del sistema por defecto); aceptar permite recordarlo. Puede cambiar de
            opinión aquí mismo o desde la app (Cuenta → Mis aceptaciones →
            Configurar cookies). Cerrar sesión elimina tokens y la cookie.
          </p>
          <p>
            <ReabrirCookies />
          </p>
        </section>

        <Link className={s.backLink} href="/">
          <span aria-hidden="true">←</span> Volver al inicio
        </Link>
      </div>
    </main>
  );
}
