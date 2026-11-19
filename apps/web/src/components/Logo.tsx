// Marca Kelsyx en código: K geométrica de trazos (mástil + brazos).
// currentColor: hereda el color del contenedor (claro/oscuro).
export function LogoMark({ size = 18 }: { size?: number }): React.ReactElement {
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

/** Bloque de marca completo (marca + nombre + descriptor). */
export function Brand({
  name = 'Kelsyx',
  sub = 'Legal Intelligence',
}: {
  name?: string;
  sub?: string;
}): React.ReactElement {
  return (
    <>
      <span className="brand-mark" aria-hidden="true">
        <LogoMark />
      </span>
      <span className="brand-text">
        <span className="brand-name">{name}</span>
        <span className="brand-sub">{sub}</span>
      </span>
    </>
  );
}
