'use client';

import { useEffect, useState } from 'react';
import s from './landing.module.css';

const sections = [
  { id: 'producto', label: 'Producto' },
  { id: 'trazabilidad', label: 'Trazabilidad' },
  { id: 'cobertura', label: 'Cobertura' },
  { id: 'seguridad', label: 'Seguridad' },
  { id: 'acerca', label: 'Acerca' },
  { id: 'contacto', label: 'Contacto' },
];

export function SectionNav() {
  const [active, setActive] = useState<string | null>(null);

  useEffect(() => {
    let frame = 0;

    const update = () => {
      frame = 0;
      const marker = window.scrollY + Math.min(window.innerHeight * 0.35, 280);
      let next: string | null = null;

      for (const section of sections) {
        const element = document.getElementById(section.id);
        if (element && element.offsetTop <= marker) {
          next = section.id;
        }
      }

      setActive(next);
    };

    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(update);
    };

    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);

    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <nav className={s.nav} aria-label="Secciones de la página">
      {sections.map((section) => {
        const isActive = active === section.id;
        return (
          <a
            key={section.id}
            className={`${s.navLink} ${isActive ? s.navLinkActive : ''}`}
            href={`/#${section.id}`}
            aria-current={isActive ? 'location' : undefined}
          >
            {section.label}
          </a>
        );
      })}
    </nav>
  );
}
