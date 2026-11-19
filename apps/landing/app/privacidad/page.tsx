import type { Metadata } from 'next';
import Link from 'next/link';
import { Brand } from '../Logo';
import s from '../landing.module.css';

export const metadata: Metadata = {
  title: 'Política de Tratamiento de Datos',
  description:
    'Cómo Kelsyx trata sus datos personales según la Ley 1581 de 2012: datos, finalidades, derechos, transferencias y canal habeas data.',
  alternates: {
    canonical: '/privacidad',
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function PrivacidadPage() {
  return (
    <main className={s.legalPage} id="contenido">
      <header className={s.legalHeader}>
        <Brand />
        <h1 className={s.legalTitle}>Política de Tratamiento de Datos Personales</h1>
        <p className={s.legalMeta}>Versión v1.0 · 18 de noviembre de 2026</p>
      </header>

      <div className={s.legalBody}>
        <section className={s.legalSection}>
          <h2>1. Responsable y base normativa</h2>
          <p>
            Responsable: Andrés Felipe Ángel (persona natural, Colombia) —{' '}
            <a href="mailto:srfilif@gmail.com">srfilif@gmail.com</a>. Base: Constitución
            art. 15, Ley 1581 de 2012, Decreto 1074 de 2015 y lineamientos de la SIC.
          </p>
        </section>

        <section className={s.legalSection}>
          <h2>2. Datos que se recopilan</h2>
          <p>
            Cuenta (correo, hash de contraseña, nombre visible, rol, estado);
            seguridad (sesiones, IP, agente de usuario, TOTP cifrado); preferencias;
            contenido del servicio (conversaciones, proyectos, archivos .txt/.md,
            memorias, investigaciones); facturación en modo demostración. El
            formulario de contacto de esta página solo abre su correo (mailto), no
            envía datos al servidor. No se piden datos sensibles ni de menores,
            pero lo que usted escriba puede contenerlos: la plataforma no filtra
            contenidos automáticamente.
          </p>
        </section>

        <section className={s.legalSection}>
          <h2>3. Finalidades y autorización</h2>
          <p>
            Crear y administrar su cuenta, autenticar y proteger el acceso, prestar
            las funciones solicitadas, cumplir la ley y atender sus solicitudes. El
            tratamiento requiere su autorización previa, expresa e informada en
            casilla independiente al registrarse (versión, fecha y hora quedan
            registradas). Sin autorización no es posible crear la cuenta. Sus datos
            no se venden ni se usan para publicidad de terceros.
          </p>
        </section>

        <section className={s.legalSection}>
          <h2>4. Sus derechos</h2>
          <p>
            Conocer, actualizar y rectificar; pedir prueba de la autorización;
            conocer el uso dado; revocar o pedir supresión; quejarse ante la SIC.
            Ejérzalos en la app (Cuenta: perfil, exportación JSON, borrado en 2
            pasos) o por correo con asunto “Habeas data”. Consultas: máximo 10 días
            hábiles; reclamos: máximo 15 días hábiles.
          </p>
        </section>

        <section className={s.legalSection}>
          <h2>5. Terceros y transferencias internacionales</h2>
          <p>
            Sus contenidos pueden procesarlos: Meta Model API (IA), Google Gemini u
            Ollama local (embeddings), el proveedor SMTP (correos) y el hosting.
            Meta y Google procesan fuera de Colombia; al aceptar usted autoriza
            expresamente estas transferencias. No cargue información confidencial,
            sensible o de menores.
          </p>
        </section>

        <section className={s.legalSection}>
          <h2>6. Conservación, seguridad y revocatoria</h2>
          <p>
            Al cerrar la cuenta se anonimiza el perfil, se revocan sesiones, los
            archivos se borran de inmediato y la facturación se conserva por
            obligación legal. Seguridad: scrypt, TOTP cifrado, sesiones rotatorias,
            cookie HttpOnly y auditoría. Puede revocar la autorización total
            (cierre de cuenta) o borrar contenidos parciales desde la app. Detalle
            en <Link href="/cookies">Cookies</Link> y <Link href="/terminos">Términos</Link>.
          </p>
        </section>

        <Link className={s.backLink} href="/">
          <span aria-hidden="true">←</span> Volver al inicio
        </Link>
      </div>
    </main>
  );
}
