import Link from 'next/link';
import { ThemeToggle } from './ThemeToggle';
import s from './landing.module.css';

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:5173').replace(
  /\/$/,
  '',
);

const appUrl = (path: string): string => `${APP_URL}${path}`;

const faqs = [
  {
    q: '¿Lex Colombia es asesoría jurídica?',
    a: 'No. Es una herramienta de investigación y productividad. Las respuestas deben revisarse y validarse por un profesional del derecho antes de tomar cualquier decisión.',
  },
  {
    q: '¿De dónde salen las respuestas?',
    a: 'De la recuperación sobre el corpus documental desplegado y, cuando trabajas dentro de un proyecto, de los archivos que hayas cargado en ese proyecto. Las citas enlazan al fragmento recuperado y, cuando está disponible, a la fuente oficial.',
  },
  {
    q: '¿Puedo cargar PDF o Word?',
    a: 'Hoy la indexación de archivos de proyecto acepta .txt y .md. La extracción de PDF y DOCX, el resumen automático o la detección de cláusulas todavía no están disponibles y no se simulan en la interfaz.',
  },
  {
    q: '¿La vigencia normativa está garantizada?',
    a: 'No. El corpus puede declarar un estado de vigencia, pero no sustituye la consulta de la publicación oficial. Antes de actuar, verifica siempre el texto y la vigencia en la fuente.',
  },
  {
    q: '¿Qué cubre el corpus?',
    a: 'Depende de la instalación. En el despliegue actual se trabaja con normativa de contratación estatal y constitucional, jurisprudencia relacionada y datos de SECOP II. No es una base universal de todo el ordenamiento colombiano.',
  },
  {
    q: '¿Cómo se protege mi cuenta?',
    a: 'Cada cuenta mantiene sus conversaciones, proyectos y archivos separados. El acceso admite verificación en dos pasos con TOTP, sesiones revocables y exportación o eliminación de los datos de la cuenta.',
  },
];

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3001';

const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Organization',
      '@id': `${siteUrl}/#organization`,
      name: 'Lex Colombia',
      url: siteUrl,
      description:
        'Investigación jurídica asistida sobre normativa, jurisprudencia y contratos públicos de Colombia.',
      areaServed: 'CO',
    },
    {
      '@type': 'WebSite',
      '@id': `${siteUrl}/#website`,
      url: siteUrl,
      name: 'Lex Colombia',
      inLanguage: 'es-CO',
      publisher: { '@id': `${siteUrl}/#organization` },
    },
    {
      '@type': 'SoftwareApplication',
      name: 'Lex Colombia',
      applicationCategory: 'LegalService',
      operatingSystem: 'Web',
      url: APP_URL,
      inLanguage: 'es-CO',
      description:
        'Espacio de trabajo para consultar normativa colombiana, jurisprudencia y contratos públicos con citas al fragmento que respalda cada afirmación.',
      featureList: [
        'Consulta normativa con citas al fragmento',
        'Investigación jurídica estructurada',
        'Búsqueda en la biblioteca del corpus',
        'Consulta de contratos SECOP II',
        'Proyectos con documentos de contexto',
      ],
      publisher: { '@id': `${siteUrl}/#organization` },
    },
    {
      '@type': 'FAQPage',
      mainEntity: faqs.map((f) => ({
        '@type': 'Question',
        name: f.q,
        acceptedAnswer: { '@type': 'Answer', text: f.a },
      })),
    },
  ],
};

export default function LandingPage() {
  const year = new Date().getFullYear();

  return (
    <div className={s.page}>
      <a className="skip-link" href="#contenido">
        Saltar al contenido
      </a>

      <header className={s.header}>
        <div className={s.headerInner}>
          <Link href="/" className={s.brand} aria-label="Lex Colombia, inicio">
            <span className={s.mark} aria-hidden="true">
              L
            </span>
            <span className={s.wordmark}>
              <strong>Lex Colombia</strong>
              <span>Investigación jurídica</span>
            </span>
          </Link>

          <nav className={s.nav} aria-label="Secciones de la página">
            <a className={s.navLink} href="#producto">
              Producto
            </a>
            <a className={s.navLink} href="#trazabilidad">
              Trazabilidad
            </a>
            <a className={s.navLink} href="#cobertura">
              Cobertura
            </a>
            <a className={s.navLink} href="#seguridad">
              Seguridad
            </a>
          </nav>

          <div className={s.headerActions}>
            <ThemeToggle />
            <a className={s.enter} href={APP_URL}>
              Entrar <span aria-hidden="true">↗</span>
            </a>
          </div>
        </div>
      </header>

      <main id="contenido">
        <section className={s.hero} aria-labelledby="hero-title">
          <div className={s.heroCopy}>
            <p className={s.eyebrow}>
              <span className={s.eyebrowRule} aria-hidden="true" />
              Investigación jurídica · Colombia
            </p>
            <h1 id="hero-title" className={s.heroTitle}>
              Derecho colombiano,
              <em>con la fuente a la vista.</em>
            </h1>
            <p className={s.heroLead}>
              Un espacio de trabajo para consultar normativa, jurisprudencia y contratos
              públicos. Cada afirmación relevante queda enlazada al fragmento que la respalda,
              para que puedas leer la fuente antes de confiar en la respuesta.
            </p>

            <div className={s.heroActions}>
              <a className={s.primary} href={APP_URL}>
                Abrir la plataforma <span aria-hidden="true">→</span>
              </a>
              <a className={s.textLink} href="#producto">
                Ver cómo funciona <span aria-hidden="true">↓</span>
              </a>
            </div>

            <p className={s.finePrint}>
              Herramienta de investigación y productividad. No sustituye el criterio profesional
              ni constituye asesoría jurídica. La vigencia normativa debe verificarse en la
              publicación oficial.
            </p>

            <ul className={s.heroFacts} aria-label="Características principales">
              <li className={s.heroFact}>
                <b>01</b> Citas al fragmento
              </li>
              <li className={s.heroFact}>
                <b>02</b> Proyectos por expediente
              </li>
              <li className={s.heroFact}>
                <b>03</b> SECOP II
              </li>
            </ul>
          </div>

          <figure
            className={s.heroVisual}
            aria-label="Vista de producto: una consulta jurídica con su fuente citada y el fragmento recuperado."
          >
            <div className={s.artifact}>
              <div className={s.artifactTop}>
                <span>Vista de producto</span>
                <span>LEX / 01</span>
              </div>

              <div className={s.artifactCard}>
                <div className={s.artifactHeader}>
                  <span className={s.tag}>Asistente jurídico</span>
                  <span className={s.status}>
                    <span className={s.statusDot} aria-hidden="true" />
                    Corpus disponible
                  </span>
                </div>

                <p className={s.queryLabel}>Consulta</p>
                <p className={s.query}>
                  ¿Cómo se aplica el principio de transparencia en la contratación estatal?
                </p>

                <div className={s.answerBlock}>
                  <p>
                    La respuesta se construye sobre los fragmentos recuperados del corpus. Cada
                    afirmación relevante queda enlazada a la fuente que la respalda; cuando la
                    evidencia es insuficiente, se advierte.
                  </p>
                </div>

                <div className={s.citations} aria-label="Fuentes citadas">
                  <span className={s.citation}>
                    <b>[1]</b> Ley 80 de 1993 · Art. 24
                  </span>
                  <span className={s.citationMuted}>+ 2 fuentes</span>
                </div>

                <div className={s.sourceCard}>
                  <span className={s.sourceMeta}>
                    <span className={s.sourceKicker}>Fuente citada</span>
                    <span className={s.sourceTitle}>Ley 80 de 1993</span>
                    <span className={s.sourceSub}>
                      Congreso de la República · Artículo 24
                    </span>
                  </span>
                  <span className={s.sourceArrow} aria-hidden="true">
                    ↗
                  </span>
                </div>

                <div className={s.artifactFoot}>
                  <span>Respuesta con apoyo documental</span>
                  <span>Verificar vigencia</span>
                </div>
              </div>

              <div className={s.artifactNote}>
                <span className={s.noteRule} aria-hidden="true" />
                Fuente → fragmento → afirmación
              </div>
              <span className={s.stamp} aria-hidden="true">
                Trazable
              </span>
            </div>
          </figure>
        </section>

        <section className={s.section} id="producto" aria-labelledby="producto-title">
          <div className={s.sectionInner}>
            <div className={s.sectionGrid}>
              <div className={s.sectionAside}>
                <p className={s.kicker}>01 / Producto</p>
                <h2 id="producto-title" className={s.display2}>
                  Un método de trabajo, no una caja de texto.
                </h2>
                <p>
                  La conversación es la entrada. El producto es la investigación: consultas con
                  contexto, fuentes localizables y un informe que puedes revisar, citar y
                  exportar.
                </p>
                <a className={s.inlineLink} href={appUrl('/chat')}>
                  Explorar la plataforma <span aria-hidden="true">↗</span>
                </a>
              </div>

              <ol className={s.featureList}>
                <li className={s.feature}>
                  <span className={s.featureNum}>01</span>
                  <div className={s.featureBody}>
                    <h3>Consulta normativa</h3>
                    <p>
                      Pregunta por una norma, un artículo o un concepto. La búsqueda combina
                      coincidencia textual y semántica sobre el corpus indexado.
                    </p>
                  </div>
                  <span className={s.featureMeta}>Corpus</span>
                </li>
                <li className={s.feature}>
                  <span className={s.featureNum}>02</span>
                  <div className={s.featureBody}>
                    <h3>Jurisprudencia y autoridad</h3>
                    <p>
                      Localiza providencias y distingue la norma de la interpretación. La
                      autoridad emisora se muestra junto a la cita.
                    </p>
                  </div>
                  <span className={s.featureMeta}>Fuentes</span>
                </li>
                <li className={s.feature}>
                  <span className={s.featureNum}>03</span>
                  <div className={s.featureBody}>
                    <h3>Documentos del expediente</h3>
                    <p>
                      Carga archivos .txt o .md en un proyecto y consúltalos con el contexto de
                      ese caso, sin mezclar conversaciones ni fuentes entre asuntos.
                    </p>
                  </div>
                  <span className={s.featureMeta}>Proyectos</span>
                </li>
                <li className={s.feature}>
                  <span className={s.featureNum}>04</span>
                  <div className={s.featureBody}>
                    <h3>Informe de investigación</h3>
                    <p>
                      Convierte la consulta en un informe con afirmaciones clasificadas por
                      respaldo documental y citas que puedes abrir y contrastar.
                    </p>
                  </div>
                  <span className={s.featureMeta}>Informe</span>
                </li>
              </ol>
            </div>
          </div>
        </section>

        <section
          className={s.darkSection}
          id="trazabilidad"
          aria-labelledby="trazabilidad-title"
        >
          <div className={s.darkInner}>
            <div className={s.darkHead}>
              <div>
                <p className={s.kickerLight}>02 / Trazabilidad</p>
                <h2 id="trazabilidad-title" className={s.display2}>
                  La diferencia no es la respuesta. Es lo que puedes verificar.
                </h2>
              </div>
              <p>
                Un sistema de citas no sirve si no puedes llegar al documento. Cada referencia
                abre el fragmento, su contexto y la fuente oficial cuando está disponible.
              </p>
            </div>

            <div className={s.layerGrid}>
              <article className={s.layer}>
                <span className={s.layerNum}>01</span>
                <h3>Fuente</h3>
                <p>
                  Norma, jurisprudencia o documento del expediente. Se muestra la autoridad, el
                  estado de vigencia declarado y el enlace oficial cuando existe.
                </p>
              </article>
              <article className={s.layer}>
                <span className={s.layerNum}>02</span>
                <h3>Análisis</h3>
                <p>
                  La interpretación generada por el modelo se mantiene separada del texto de la
                  fuente. No se presenta como si fuera una cita literal.
                </p>
              </article>
              <article className={s.layer}>
                <span className={s.layerNum}>03</span>
                <h3>Validación</h3>
                <p>
                  Si la evidencia recuperada es insuficiente, la respuesta lo advierte. La
                  decisión jurídica permanece en tus manos.
                </p>
              </article>
            </div>

            <blockquote className={s.pullQuote}>
              “La IA no debe presentar una interpretación como si fuera el texto literal de una
              norma.”
            </blockquote>
          </div>
        </section>

        <section className={s.section} id="como-funciona" aria-labelledby="metodo-title">
          <div className={s.sectionInner}>
            <div className={s.methodHead}>
              <div>
                <p className={s.kicker}>03 / Método</p>
                <h2 id="metodo-title" className={s.display2}>
                  Tres movimientos. Cero cajas negras.
                </h2>
              </div>
              <p style={{ maxWidth: '40ch' }}>
                El agente muestra las herramientas que usa. Tú decides en qué momento abrir la
                fuente y cuándo llevar la conclusión al expediente.
              </p>
            </div>

            <ol className={s.steps}>
              <li className={s.step}>
                <span className={s.stepNum}>01</span>
                <h3>Plantea</h3>
                <p>
                  Formula la pregunta o abre un proyecto con los documentos del caso. El contexto
                  queda acotado a ese asunto.
                </p>
              </li>
              <li className={s.step}>
                <span className={s.stepNum}>02</span>
                <h3>Recupera</h3>
                <p>
                  El agente busca en el corpus y en tus archivos. Las herramientas utilizadas y el
                  proceso quedan a la vista.
                </p>
              </li>
              <li className={s.step}>
                <span className={s.stepNum}>03</span>
                <h3>Contrasta</h3>
                <p>
                  Abre cada cita, revisa la autoridad y la vigencia, y exporta el informe para
                  incorporarlo a tu trabajo.
                </p>
              </li>
            </ol>
          </div>
        </section>

        <section
          className={`${s.section} ${s.coverage}`}
          id="cobertura"
          aria-labelledby="cobertura-title"
        >
          <div className={s.coverageGrid}>
            <div className={s.coverageCopy}>
              <p className={s.kicker}>04 / Cobertura</p>
              <h2 id="cobertura-title" className={s.display2}>
                Un corpus con límites explícitos.
              </h2>
              <p>
                Lex Colombia trabaja sobre el corpus que tenga cargado cada instalación. En el
                despliegue actual: normativa de contratación estatal y constitucional,
                jurisprudencia relacionada y datos de SECOP II. No es una base universal de todo
                el ordenamiento.
              </p>
              <div className={s.warning}>
                <span className={s.warningMark} aria-hidden="true">
                  !
                </span>
                <span>
                  La vigencia normativa no está garantizada. Verifica siempre la publicación
                  oficial antes de actuar.
                </span>
              </div>
            </div>

            <dl className={s.coverageList}>
              <div className={s.coverageItem}>
                <dt className={s.coverageTerm}>Normativa</dt>
                <dd className={s.coverageDesc}>
                  Leyes, decretos y normas indexadas por fragmentos, con metadatos de autoridad y
                  vigencia cuando están disponibles.
                </dd>
                <span className={s.coverageTag}>Indexada</span>
              </div>
              <div className={s.coverageItem}>
                <dt className={s.coverageTerm}>Jurisprudencia</dt>
                <dd className={s.coverageDesc}>
                  Providencias y referencias presentes en el corpus desplegado, distinguidas de la
                  normativa y de la interpretación del modelo.
                </dd>
                <span className={s.coverageTag}>Fuentes</span>
              </div>
              <div className={s.coverageItem}>
                <dt className={s.coverageTerm}>SECOP II</dt>
                <dd className={s.coverageDesc}>
                  Contratos públicos sincronizados, con filtros por entidad, proveedor, modalidad
                  y valor, y enlace al origen de cada registro.
                </dd>
                <span className={s.coverageTag}>Contratación</span>
              </div>
            </dl>
          </div>
        </section>

        <section className={s.section} id="seguridad" aria-labelledby="seguridad-title">
          <div className={s.securityGrid}>
            <div>
              <p className={s.kicker}>05 / Seguridad</p>
              <h2 id="seguridad-title" className={s.display2}>
                Diseñado para información que no debería circular.
              </h2>
              <p>
                El trabajo jurídico vive en el detalle y en la confidencialidad. La plataforma
                separa tus espacios y te da control sobre el acceso y sobre tus datos.
              </p>
            </div>

            <ul className={s.securityList}>
              <li className={s.securityItem}>
                <span className={s.securityNum}>01</span>
                <div>
                  <strong>Aislamiento por cuenta</strong>
                  <p>
                    Conversaciones, proyectos y archivos quedan asociados a tu cuenta y no se
                    mezclan con los de otros usuarios.
                  </p>
                </div>
              </li>
              <li className={s.securityItem}>
                <span className={s.securityNum}>02</span>
                <div>
                  <strong>Verificación en dos pasos</strong>
                  <p>
                    Segundo factor con TOTP y códigos de recuperación de un solo uso para el
                    acceso a la cuenta.
                  </p>
                </div>
              </li>
              <li className={s.securityItem}>
                <span className={s.securityNum}>03</span>
                <div>
                  <strong>Sesiones revocables</strong>
                  <p>
                    Consulta los dispositivos activos, revoca sesiones individuales o cierra
                    todas las sesiones desde la cuenta.
                  </p>
                </div>
              </li>
              <li className={s.securityItem}>
                <span className={s.securityNum}>04</span>
                <div>
                  <strong>Control de tus datos</strong>
                  <p>
                    Exporta la información de tu cuenta o solicita su eliminación desde la
                    configuración de la plataforma.
                  </p>
                </div>
              </li>
            </ul>
          </div>
        </section>

        <section className={s.section} id="para-quien" aria-labelledby="audiencia-title">
          <div className={s.audienceHead}>
            <p className={s.kicker}>06 / Para quién</p>
            <h2 id="audiencia-title" className={s.display2}>
              Para quien trabaja con el texto, no con el resumen.
            </h2>
          </div>

          <div className={s.audienceGrid}>
            <article className={s.audienceItem}>
              <span className={s.audienceNum}>01</span>
              <div>
                <h3>Abogados y firmas</h3>
                <p>Investiga más rápido sin perder la referencia que sostiene cada afirmación.</p>
              </div>
            </article>
            <article className={s.audienceItem}>
              <span className={s.audienceNum}>02</span>
              <div>
                <h3>Departamentos jurídicos</h3>
                <p>Organiza consultas y documentos por proyecto, asunto o expediente.</p>
              </div>
            </article>
            <article className={s.audienceItem}>
              <span className={s.audienceNum}>03</span>
              <div>
                <h3>Investigadores y estudiantes</h3>
                <p>Aprende a contrastar fuentes en lugar de repetir una respuesta generada.</p>
              </div>
            </article>
            <article className={s.audienceItem}>
              <span className={s.audienceNum}>04</span>
              <div>
                <h3>Sector público</h3>
                <p>Consulta contratación estatal y SECOP con enlaces al registro de origen.</p>
              </div>
            </article>
          </div>
        </section>

        <section className={s.section} id="preguntas" aria-labelledby="faq-title">
          <div className={s.faqGrid}>
            <div>
              <p className={s.kicker}>07 / Dudas</p>
              <h2 id="faq-title" className={s.display2}>
                Lo que conviene saber antes de entrar.
              </h2>
              <p>
                Sin promesas de exactitud absoluta. Estas son las reglas con las que está
                construida la plataforma.
              </p>
            </div>

            <div className={s.faqList}>
              {faqs.map((faq) => (
                <details key={faq.q} className={s.faqItem}>
                  <summary className={s.faqSummary}>{faq.q}</summary>
                  <p className={s.faqAnswer}>{faq.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section className={s.cta} aria-labelledby="cta-title">
          <span className={s.ctaMark} aria-hidden="true">
            L
          </span>
          <div className={s.ctaInner}>
            <div>
              <p className={s.kickerLight}>Acceso</p>
              <h2 id="cta-title" className={s.ctaTitle}>
                Abre el expediente.
              </h2>
              <p className={s.ctaLead}>
                Entra a la plataforma y haz la primera consulta. Si tu instalación requiere
                invitación, usa las credenciales de tu organización.
              </p>
            </div>
            <div className={s.ctaActions}>
              <a className={s.ctaPrimary} href={APP_URL}>
                Entrar a Lex Colombia <span aria-hidden="true">↗</span>
              </a>
              <Link className={s.ctaGhost} href="/aviso-legal">
                Leer el aviso legal
              </Link>
              <p className={s.ctaFine}>
                Investigación asistida. Verificación profesional obligatoria.
              </p>
            </div>
          </div>
        </section>
      </main>

      <footer className={s.footer}>
        <div className={s.footerTop}>
          <div className={s.footerBrand}>
            <Link href="/" className={s.brand} aria-label="Lex Colombia, inicio">
              <span className={s.mark} aria-hidden="true">
                L
              </span>
              <span className={s.wordmark}>
                <strong>Lex Colombia</strong>
                <span>Investigación jurídica</span>
              </span>
            </Link>
            <p className={s.footerTagline}>
              Las fuentes primero. La interpretación, después.
            </p>
            <p className={s.footerNote}>
              Herramienta de apoyo a la investigación jurídica. No es asesoría legal ni
              representación. La disponibilidad y vigencia de las fuentes depende de la
              instalación y del corpus cargado.
            </p>
          </div>

          <div className={s.footerCols}>
            <div className={s.footerCol}>
              <h3>Producto</h3>
              <a className={s.footerLink} href={appUrl('/chat')}>
                Asistente jurídico
              </a>
              <a className={s.footerLink} href={appUrl('/investigar')}>
                Investigación
              </a>
              <a className={s.footerLink} href={appUrl('/biblioteca')}>
                Biblioteca
              </a>
              <a className={s.footerLink} href={appUrl('/storage')}>
                Documentos
              </a>
            </div>
            <div className={s.footerCol}>
              <h3>Acceso</h3>
              <a className={s.footerLink} href={APP_URL}>
                Entrar a la plataforma
              </a>
              <Link className={s.footerLink} href="/aviso-legal">
                Aviso legal
              </Link>
              <a className={s.footerLink} href="#trazabilidad">
                Cómo citamos
              </a>
              <a className={s.footerLink} href="#seguridad">
                Seguridad
              </a>
            </div>
          </div>
        </div>

        <div className={s.footerBottom}>
          <span>© {year} Lex Colombia · Colombia</span>
          <span>Investigación jurídica con fuentes verificables</span>
          <span>Vigencia normativa no garantizada</span>
        </div>
      </footer>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
    </div>
  );
}
