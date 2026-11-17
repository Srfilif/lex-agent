import type { Metadata } from 'next';
import Link from 'next/link';
import s from '../landing.module.css';

export const metadata: Metadata = {
  title: 'Aviso legal',
  description:
    'Condiciones de uso, límites del servicio y tratamiento de fuentes de Lex Colombia, plataforma de investigación jurídica.',
  alternates: {
    canonical: '/aviso-legal',
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function AvisoLegalPage() {
  return (
    <main className={s.legalPage} id="contenido">
      <header className={s.legalHeader}>
        <Link href="/" className={s.brand} aria-label="Lex Colombia, inicio">
          <span className={s.mark} aria-hidden="true">
            L
          </span>
          <span className={s.wordmark}>
            <strong>Lex Colombia</strong>
            <span>Investigación jurídica</span>
          </span>
        </Link>
        <h1 className={s.legalTitle}>Aviso legal y límites del servicio</h1>
        <p className={s.legalMeta}>Última actualización · noviembre de 2026</p>
      </header>

      <div className={s.legalBody}>
        <section className={s.legalSection}>
          <h2>Naturaleza del servicio</h2>
          <p>
            Lex Colombia es una herramienta de investigación y productividad jurídica. No presta
            asesoría legal, no representa a ninguna parte y no sustituye el criterio de un
            profesional del derecho. Toda decisión que se derive del uso de la plataforma es
            responsabilidad de quien la adopta.
          </p>
        </section>

        <section className={s.legalSection}>
          <h2>Fuentes y vigencia</h2>
          <p>
            Las respuestas se apoyan en el corpus documental cargado en cada instalación y, cuando
            corresponde, en los archivos de un proyecto. La disponibilidad de las fuentes varía
            según el despliegue.
          </p>
          <p>
            El estado de vigencia que muestra la plataforma es el declarado en los metadatos
            disponibles. No constituye una certificación de vigencia ni reemplaza la consulta de
            la publicación oficial. Verifica siempre el texto normativo antes de actuar.
          </p>
        </section>

        <section className={s.legalSection}>
          <h2>Interpretación asistida por inteligencia artificial</h2>
          <p>
            La plataforma distingue, cuando los datos lo permiten, entre el contenido de una
            fuente y el análisis generado por el modelo. Una interpretación no debe leerse como el
            texto literal de una norma o de una providencia.
          </p>
          <p>
            Cuando la evidencia recuperada es insuficiente, la respuesta puede advertirlo o
            abstenerse de afirmar un hecho. Esa advertencia no elimina la necesidad de revisar las
            fuentes y el razonamiento jurídico.
          </p>
        </section>

        <section className={s.legalSection}>
          <h2>Datos y cuentas</h2>
          <p>
            Cada cuenta mantiene sus conversaciones, proyectos y archivos separados de los de
            otros usuarios. La plataforma permite administrar sesiones, activar verificación en
            dos pasos, exportar la información de la cuenta y solicitar su eliminación.
          </p>
          <p>
            El tratamiento concreto de los datos depende de la organización que administra la
            instalación y de la configuración de despliegue. Consulta sus políticas internas antes
            de cargar información confidencial.
          </p>
        </section>

        <section className={s.legalSection}>
          <h2>Textos y marcas de terceros</h2>
          <p>
            Los textos normativos, jurisprudencias y registros de contratación pertenecen a sus
            fuentes oficiales. La plataforma los referencia con fines de investigación y no
            reclama su titularidad. Las marcas y nombres de terceros pertenecen a sus respectivos
            titulares.
          </p>
        </section>

        <section className={s.legalSection}>
          <h2>Contacto</h2>
          <p>
            Para asuntos de soporte, privacidad o uso de la plataforma, utiliza los canales de la
            organización que administra tu instalación. Esta página no publica datos de contacto
            genéricos para evitar dirigir solicitudes a un destinatario incorrecto.
          </p>
        </section>

        <Link className={s.backLink} href="/">
          <span aria-hidden="true">←</span> Volver al inicio
        </Link>
      </div>
    </main>
  );
}
