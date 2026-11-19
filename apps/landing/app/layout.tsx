import type { Metadata, Viewport } from 'next';
import { Instrument_Serif, Inter } from 'next/font/google';
import './globals.css';
import { CookieNotice } from './CookieNotice';

const display = Instrument_Serif({
  subsets: ['latin'],
  weight: '400',
  style: ['normal', 'italic'],
  variable: '--font-display',
  display: 'swap',
  preload: true,
});

const sans = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
  preload: true,
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3001';

const title = 'Kelsyx — Investigación jurídica con fuentes verificables';
const description =
  'Espacio de trabajo para consultar normativa, jurisprudencia y contratos públicos de Colombia. Cada afirmación relevante queda enlazada al fragmento que la respalda.';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: title,
    template: '%s · Kelsyx',
  },
  description,
  applicationName: 'Kelsyx',
  authors: [{ name: 'Andrés Felipe Ángel', url: 'https://srfilif.dev' }],
  creator: 'Andrés Felipe Ángel',
  publisher: 'Kelsyx',
  category: 'legal technology',
  keywords: [
    'investigación jurídica',
    'derecho colombiano',
    'normativa colombiana',
    'jurisprudencia',
    'contratación estatal',
    'SECOP II',
    'LegalTech Colombia',
    'asistente jurídico',
    'RAG jurídico',
    'citas verificables',
  ],
  alternates: {
    canonical: '/',
  },
  manifest: '/manifest.webmanifest',
  openGraph: {
    type: 'website',
    locale: 'es_CO',
    url: '/',
    siteName: 'Kelsyx',
    title,
    description,
  },
  twitter: {
    card: 'summary_large_image',
    title,
    description,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  formatDetection: {
    telephone: false,
    email: false,
    address: false,
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  colorScheme: 'light dark',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f4f3ed' },
    { media: '(prefers-color-scheme: dark)', color: '#0b0f0d' },
  ],
};

const themeScript = `(function(){try{if(localStorage.getItem('lex_theme_optout')==='1'){var s=window.matchMedia('(prefers-color-scheme: dark)').matches;document.documentElement.dataset.theme=s?'dark':'light';return;}var t=localStorage.getItem('lex_theme');var d=t==='dark'||(t!=='light'&&window.matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.dataset.theme=d?'dark':'light';}catch(e){document.documentElement.dataset.theme='light';}})();`;

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es-CO" className={`${display.variable} ${sans.variable}`} suppressHydrationWarning>
      <body>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        {children}
        <CookieNotice />
      </body>
    </html>
  );
}
