import type { Metadata } from 'next';
import Link from 'next/link';
import { Brand } from '../Logo';
import s from '../landing.module.css';

export const metadata: Metadata = {
  title: 'Términos del Servicio',
  description:
    'Condiciones de uso de Kelsyx: objeto, modalidad gratuita limitada, obligaciones, responsabilidad y solución de controversias.',
  alternates: {
    canonical: '/terminos',
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function TerminosPage() {
  return (
    <main className={s.legalPage} id="contenido">
      <header className={s.legalHeader}>
        <Brand />
        <h1 className={s.legalTitle}>Términos del Servicio</h1>
        <p className={s.legalMeta}>Versión v1.0 · 18 de noviembre de 2026</p>
      </header>

      <div className={s.legalBody}>
        <section className={s.legalSection}>
          <h2>1. Operador y contacto</h2>
          <p>
            Operador: Andrés Felipe Ángel (persona natural, Colombia). Contacto:{' '}
            <a href="mailto:srfilif@gmail.com">srfilif@gmail.com</a> y{' '}
            <a href="https://srfilif.dev" target="_blank" rel="noreferrer">
              srfilif.dev
            </a>
            . Al crear una cuenta usted acepta estos términos; la aceptación queda registrada
            con versión, fecha y hora.
          </p>
        </section>

        <section className={s.legalSection}>
          <h2>2. Objeto: herramienta de investigación, no asesoría</h2>
          <p>
            Kelsyx es una herramienta de investigación y productividad jurídica sobre
            normativa colombiana: chat con citas al fragmento, proyectos con archivos,
            memoria de usuario, investigaciones asistidas y datos públicos SECOP. No
            presta asesoría legal, no representa a ninguna parte y no sustituye el
            criterio de un abogado.
          </p>
        </section>

        <section className={s.legalSection}>
          <h2>3. Funciones y limitaciones</h2>
          <p>
            Incluye registro con verificación de correo y segundo factor opcional,
            proyectos (solo archivos .txt y .md, topes de tamaño y conteo), memoria
            opcional desactivada por defecto, exportación y borrado de cuenta. La
            vigencia normativa mostrada no es una certificación; las respuestas de IA
            deben verificarse en fuentes oficiales. El panel de facturación opera en
            modo demostración, sin cobros reales.
          </p>
        </section>

        <section className={s.legalSection}>
          <h2>4. Registro y obligaciones del usuario</h2>
          <p>
            Mayores de 18 años, una cuenta personal por persona. El registro exige
            aceptar estos términos y autorizar el tratamiento de datos en casillas
            independientes. Usted custodia sus credenciales, verifica las respuestas
            antes de actuar y respeta la ley y el uso aceptable (sin vulnerar
            seguridad, sin datos ajenos, sin eludir límites).
          </p>
        </section>

        <section className={s.legalSection}>
          <h2>5. Modalidad gratuita limitada</h2>
          <p>
            El acceso gratuito tiene límites de uso, modelos, almacenamiento y
            disponibilidad según capacidad. Puede ajustarse o descontinuarse con 30
            días de aviso. La gratuidad no elimina los deberes de información,
            seguridad y protección de datos del operador.
          </p>
        </section>

        <section className={s.legalSection}>
          <h2>6. Disponibilidad y soporte</h2>
          <p>
            Objetivo de disponibilidad razonable, sin garantía de continuidad
            ininterrumpida ni tiempos de respuesta garantizados en la modalidad
            gratuita. Puede haber mantenimientos e interrupciones por fallos
            técnicos, de terceros o fuerza mayor.
          </p>
        </section>

        <section className={s.legalSection}>
          <h2>7. Propiedad intelectual y terceros</h2>
          <p>
            El código propio se distribuye bajo{' '}
            <Link href="/licencia">PolyForm Noncommercial 1.0.0</Link> (uso comercial
            reservado). Usted conserva sus contenidos y otorga solo la licencia
            necesaria para prestarle el servicio. Se usan proveedores externos (IA,
            embeddings, correo, hosting); evite cargar datos sensibles o
            confidenciales.
          </p>
        </section>

        <section className={s.legalSection}>
          <h2>8. Responsabilidad</h2>
          <p>
            El operador responde por dolo o culpa grave y por las obligaciones
            irrenunciables (datos personales, consumidor, seguridad). No responde por
            decisiones con base en respuestas no verificadas ni por interrupciones de
            terceros o fuerza mayor. Nada aquí exonera responsabilidades que la ley
            no permite excluir.
          </p>
        </section>

        <section className={s.legalSection}>
          <h2>9. Suspensión, terminación y debido proceso</h2>
          <p>
            Ante incumplimientos hay aviso previo, motivación y descargos, salvo
            riesgo grave e inminente. Usted puede cerrar su cuenta cuando quiera
            (Cuenta → Borrar cuenta) y exportar sus datos. Al terminar se anonimiza
            el perfil y aplican las retenciones legales informadas en la{' '}
            <Link href="/privacidad">Política de Datos</Link>.
          </p>
        </section>

        <section className={s.legalSection}>
          <h2>10. Cambios, ley aplicable y reclamos</h2>
          <p>
            Los cambios sustanciales se avisan con 30 días; el uso posterior implica
            aceptación. Rige la ley colombiana, con jueces colombianos y mecanismos
            de la SIC. Reclamos: <a href="mailto:srfilif@gmail.com">srfilif@gmail.com</a>{' '}
            (asunto “Reclamo Kelsyx”); datos personales: asunto “Habeas data”.
          </p>
        </section>

        <section className={s.legalSection}>
          <h2>Documentos relacionados</h2>
          <p>
            <Link href="/privacidad">Política de Datos</Link> ·{' '}
            <Link href="/cookies">Política de Cookies</Link> ·{' '}
            <Link href="/aviso-legal">Aviso legal</Link> ·{' '}
            <Link href="/licencia">Licencia</Link>
          </p>
        </section>

        <Link className={s.backLink} href="/">
          <span aria-hidden="true">←</span> Volver al inicio
        </Link>
      </div>
    </main>
  );
}
