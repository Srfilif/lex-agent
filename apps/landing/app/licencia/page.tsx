import type { Metadata } from 'next';
import Link from 'next/link';
import { Brand } from '../Logo';
import s from '../landing.module.css';

export const metadata: Metadata = {
  title: 'Licencia',
  description:
    'Kelsyx se distribuye bajo la PolyForm Noncommercial License 1.0.0: uso libre no comercial y licencia separada para uso comercial.',
  alternates: {
    canonical: '/licencia',
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function LicenciaPage() {
  return (
    <main className={s.legalPage} id="contenido">
      <header className={s.legalHeader}>
        <Brand />
        <h1 className={s.legalTitle}>Licencia</h1>
        <p className={s.legalMeta}>PolyForm Noncommercial License 1.0.0</p>
      </header>

      <div className={s.legalBody}>
        <section className={s.legalSection}>
          <h2>Un proyecto libre para el mundo, con límites comerciales</h2>
          <p>
            Kelsyx es un proyecto <strong>source-available</strong>: el código puede
            consultarse, estudiarse, modificarse y compartirse para fines no comerciales. No es
            software Open Source certificado por OSI, porque la licencia reserva el uso comercial.
          </p>
          <p>
            El texto legal aplicable es la{' '}
            <a
              href="https://polyformproject.org/licenses/noncommercial/1.0.0"
              target="_blank"
              rel="noreferrer"
            >
              PolyForm Noncommercial License 1.0.0
            </a>
            . El texto completo también está en el archivo{' '}
            <a
              href="https://github.com/Srfilif/lex-agent/blob/main/LICENSE"
              target="_blank"
              rel="noreferrer"
            >
              LICENSE
            </a>{' '}
            del repositorio.
          </p>
        </section>

        <section className={s.legalSection}>
          <h2>Uso libre</h2>
          <p>
            Personas, estudiantes, docentes, investigadores y aficionados pueden usar, estudiar,
            modificar y distribuir el software para fines no comerciales permitidos, sujetos a los
            términos de la licencia.
          </p>
          <p>
            También se permite el uso por organizaciones benéficas, instituciones educativas,
            organizaciones de investigación pública, organismos de salud o seguridad pública,
            organizaciones de protección ambiental e instituciones gubernamentales, con
            independencia de la fuente de financiación.
          </p>
        </section>

        <section className={s.legalSection}>
          <h2>Uso comercial</h2>
          <p>
            La licencia no concede uso comercial. Empresas, negocios, organizaciones y personas
            que quieran usar el software para productos comerciales, ofertas SaaS o servicios que
            generen ingresos deben contactar al titular para obtener una licencia comercial
            separada.
          </p>
          <p>
            Para licencias comerciales, escribe a{' '}
            <a href="mailto:srfilif@gmail.com">srfilif@gmail.com</a> o visita{' '}
            <a href="https://srfilif.dev" target="_blank" rel="noreferrer">
              srfilif.dev
            </a>
            .
          </p>
        </section>

        <section className={s.legalSection}>
          <h2>Atribución</h2>
          <p>
            Desarrollador original: <strong>Andrés Felipe Ángel</strong>. Sitio web:{' '}
            <a href="https://srfilif.dev" target="_blank" rel="noreferrer">
              https://srfilif.dev
            </a>
            .
          </p>
          <p>
            Los avisos de copyright y los avisos de atribución aplicables deben conservarse según
            los términos de la licencia.
          </p>
        </section>

        <Link className={s.backLink} href="/">
          <span aria-hidden="true">←</span> Volver al inicio
        </Link>
      </div>
    </main>
  );
}
