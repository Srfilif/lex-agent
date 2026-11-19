import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Kelsyx — Investigación jurídica',
    short_name: 'Kelsyx',
    description:
      'Investigación jurídica sobre normativa, jurisprudencia y contratos públicos de Colombia, con citas al fragmento.',
    start_url: '/',
    display: 'browser',
    background_color: '#f4f3ed',
    theme_color: '#0d1a13',
    lang: 'es-CO',
    icons: [
      {
        src: '/icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
      },
    ],
  };
}
