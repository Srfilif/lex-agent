import Link from 'next/link';
import s from './landing.module.css';

// Marca Kelsyx en código: K geométrica de trazos (mástil + brazos).
// currentColor: hereda el color del contenedor (claro/oscuro, hover).
export function LogoMark({ size = 20 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      stroke="currentColor"
      strokeWidth={4.5}
      strokeLinecap="square"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M10 4v24M10 15.5L23 4M13 18.5L24 28" />
    </svg>
  );
}

/** Bloque de marca completo con enlace al inicio. */
export function Brand() {
  return (
    <Link href="/" className={s.brand} aria-label="Kelsyx, inicio">
      <span className={s.mark} aria-hidden="true">
        <LogoMark />
      </span>
      <span className={s.wordmark}>
        <strong>Kelsyx</strong>
        <span>Investigación jurídica</span>
      </span>
    </Link>
  );
}
