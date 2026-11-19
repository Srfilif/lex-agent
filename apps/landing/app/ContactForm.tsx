'use client';

import { useState, type FormEvent } from 'react';
import s from './landing.module.css';

const CONTACT_EMAIL = 'srfilif@gmail.com';

export function ContactForm() {
  const [prepared, setPrepared] = useState(false);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const data = new FormData(event.currentTarget);
    const name = String(data.get('nombre') ?? '').trim();
    const email = String(data.get('correo') ?? '').trim();
    const message = String(data.get('mensaje') ?? '').trim();

    const subject = encodeURIComponent(`Contacto Kelsyx · ${name}`);
    const body = encodeURIComponent(
      [`Nombre: ${name}`, `Correo: ${email}`, '', message].join('\n'),
    );

    window.location.href = `mailto:${CONTACT_EMAIL}?subject=${subject}&body=${body}`;
    setPrepared(true);
  };

  return (
    <form className={s.contactForm} onSubmit={handleSubmit}>
      <div className={s.formHead}>
        <span>Mensaje directo</span>
        <span>01 / 03</span>
      </div>

      <div className={s.formGrid}>
        <label className={s.field}>
          <span className={s.fieldLabel}>Nombre</span>
          <input name="nombre" type="text" autoComplete="name" placeholder="Tu nombre" required />
        </label>
        <label className={s.field}>
          <span className={s.fieldLabel}>Correo</span>
          <input
            name="correo"
            type="email"
            autoComplete="email"
            placeholder="tu@correo.com"
            required
          />
        </label>
      </div>

      <label className={s.field}>
        <span className={s.fieldLabel}>Mensaje</span>
        <textarea
          name="mensaje"
          rows={5}
          placeholder="Cuéntame qué necesitas: una duda, una colaboración o una licencia comercial."
          required
        />
      </label>

      <button className={s.formSubmit} type="submit">
        Preparar correo <span aria-hidden="true">↗</span>
      </button>

      <p className={`${s.formNote} ${prepared ? s.formStatus : ''}`} role="status">
        {prepared
          ? 'Abrimos tu cliente de correo con el mensaje listo para enviar.'
          : 'Este formulario no envía datos a un servidor: abre tu cliente de correo con el mensaje preparado.'}
      </p>
    </form>
  );
}
