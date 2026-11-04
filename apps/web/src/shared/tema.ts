import type { Preferencias } from '../cuenta';

/** Aplica el tema de verdad: data-theme + variables dark en CSS. */
export function aplicarTema(theme: Preferencias['theme']): void {
  const root = document.documentElement;
  if (theme === 'system') {
    const oscuro = window.matchMedia('(prefers-color-scheme: dark)').matches;
    root.dataset['theme'] = oscuro ? 'dark' : 'light';
  } else {
    root.dataset['theme'] = theme;
  }
}
