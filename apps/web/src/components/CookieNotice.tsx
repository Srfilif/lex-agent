import { useEffect, useState } from 'react';
import { guardarEleccionCookies, leerEleccionCookies, URL_COOKIES } from '../legal';
import { Button } from './ui/button';

/**
 * Aviso de cookies/almacenamiento. Informativo + control real: rechazar borra
 * la preferencia de tema e impide guardarla (lo único opcional que existe).
 * No bloquea el acceso ni finge controlar terceros (no los hay).
 */
export default function CookieNotice(): React.ReactElement | null {
  const [visible, setVisible] = useState(() => leerEleccionCookies() === null);

  useEffect(() => {
    const onReabrir = (): void => setVisible(true);
    window.addEventListener('lex:cookies-reabrir', onReabrir);
    return () => window.removeEventListener('lex:cookies-reabrir', onReabrir);
  }, []);

  if (!visible) return null;

  function elegir(aceptar: boolean): void {
    guardarEleccionCookies(aceptar ? 'aceptadas' : 'solo-necesarias');
    setVisible(false);
  }

  return (
    <div className="cookie-notice" role="dialog" aria-label="Aviso de cookies">
      <p className="cookie-notice-text">
        Usamos almacenamiento técnico necesario para tu sesión y, si quieres, para recordar el
        tema. Sin analítica ni publicidad de terceros.{' '}
        <a href={URL_COOKIES} target="_blank" rel="noreferrer">
          Política de cookies
        </a>
      </p>
      <div className="cookie-notice-actions">
        <Button type="button" size="sm" variant="outline" onClick={() => elegir(false)}>
          Solo necesarias
        </Button>
        <Button type="button" size="sm" onClick={() => elegir(true)}>
          Aceptar
        </Button>
      </div>
    </div>
  );
}
