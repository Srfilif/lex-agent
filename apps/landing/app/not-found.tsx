import type { Metadata } from 'next';
import Link from 'next/link';
import s from './landing.module.css';

export const metadata: Metadata = {
  title: 'Página no encontrada',
  robots: {
    index: false,
    follow: false,
  },
};

export default function NotFound() {
  return (
    <main className={s.legalPage} id="contenido">
      <header className={s.legalHeader}>
        <p className={s.kicker}>Error 404</p>
        <h1 className={s.legalTitle}>Esta página no existe.</h1>
        <p className={s.legalMeta}>La dirección puede haber cambiado o estar mal escrita.</p>
      </header>
      <div className={s.legalBody}>
        <section className={s.legalSection}>
          <h2>Volvamos al expediente</h2>
          <p>
            La página principal reúne el producto, la cobertura del corpus y las condiciones de
            uso. También puedes entrar directamente a la plataforma desde allí.
          </p>
          <Link className={s.backLink} href="/">
            <span aria-hidden="true">←</span> Volver al inicio
          </Link>
        </section>
      </div>
    </main>
  );
}
