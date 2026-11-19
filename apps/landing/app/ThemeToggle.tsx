'use client';

import s from './landing.module.css';
import { puedeGuardarTema } from './cookies';

export function ThemeToggle() {
  const toggle = () => {
    const root = document.documentElement;
    const next = root.dataset.theme === 'dark' ? 'light' : 'dark';
    root.dataset.theme = next;
    if (!puedeGuardarTema()) return; // rechazó lo opcional: solo esta sesión
    try {
      localStorage.setItem('lex_theme', next);
    } catch {
      // El tema sigue funcionando durante la sesión aunque el navegador
      // bloquee el almacenamiento local.
    }
  };

  return (
    <button
      type="button"
      className={s.themeToggle}
      onClick={toggle}
      aria-label="Cambiar entre tema claro y oscuro"
      title="Cambiar tema"
    >
      <span className={s.iconMoon} aria-hidden="true">
        <svg viewBox="0 0 24 24" width="16" height="16">
          <path
            d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
        </svg>
      </span>
      <span className={s.iconSun} aria-hidden="true">
        <svg viewBox="0 0 24 24" width="16" height="16">
          <circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <path
            d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M18.7 5.3l-1.4 1.4M6.7 17.3l-1.4 1.4"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      </span>
    </button>
  );
}
