'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { guardarEleccionCookies, leerEleccionCookies, reabrirAvisoCookies } from './cookies';

/** Aviso informativo + control real del único almacenamiento opcional (tema). */
export function CookieNotice() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(leerEleccionCookies() === null);
    const onReabrir = () => setVisible(true);
    window.addEventListener('lex:cookies-reabrir', onReabrir);
    return () => window.removeEventListener('lex:cookies-reabrir', onReabrir);
  }, []);

  if (!visible) return null;

  function elegir(aceptar: boolean) {
    guardarEleccionCookies(aceptar ? 'aceptadas' : 'solo-necesarias');
    setVisible(false);
  }

  return (
    <div className="cookie-notice" role="dialog" aria-label="Aviso de cookies">
      <p className="cookie-notice-text">
        Esta página solo guarda tu preferencia de tema si la aceptas. Sin analítica ni
        publicidad de terceros. <Link href="/cookies">Política de cookies</Link>
      </p>
      <div className="cookie-notice-actions">
        <button type="button" className="cookie-btn-ghost" onClick={() => elegir(false)}>
          Solo necesarias
        </button>
        <button type="button" className="cookie-btn" onClick={() => elegir(true)}>
          Aceptar
        </button>
      </div>
    </div>
  );
}

/** Botón para reabrir la configuración (página /cookies y pie). */
export function ReabrirCookies() {
  return (
    <button type="button" className="cookie-btn-ghost" onClick={() => reabrirAvisoCookies()}>
      Configurar cookies
    </button>
  );
}
