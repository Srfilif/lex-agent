// CLI de ingesta: lee manifiesto + texto, delega en el caso de uso IngestDocument.
// Uso: npm run ingest -- ../../data/raw/ley80.manifiesto.json
// Idempotente por hash_contenido: si el texto ya existe, no duplica.
import 'reflect-metadata';
import { createHash } from 'crypto';
import { readFileSync, existsSync } from 'fs';
import { dirname, resolve } from 'path';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { normalizeText, chunkNorma, IngestDocument } from '../modules/corpus';

interface Manifiesto {
  titulo: string;
  corto: string; // 'Ley 80/1993' — prefijo de rutas
  emisor: string;
  tipo: string;
  numero: string;
  fecha?: string; // YYYY-MM-DD
  tema: string;
  autoridad?: string;
  url_original: string;
  archivo: string; // ruta al .txt/.html (relativa al manifiesto o absoluta)
}

async function main(): Promise<void> {
  const manPath = resolve(process.argv[2] ?? '');
  if (!manPath || !existsSync(manPath)) {
    console.error('Uso: npm run ingest -- <manifiesto.json>');
    process.exit(2);
  }
  const man = JSON.parse(readFileSync(manPath, 'utf-8')) as Manifiesto;
  const archPath = resolve(dirname(manPath), man.archivo);
  const raw = readFileSync(archPath, 'utf-8');
  const text = normalizeText(raw);
  const hash = createHash('sha256').update(text).digest('hex');
  const chunks = chunkNorma(text, man.corto);

  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error'] });
  try {
    const ingest = app.get(IngestDocument);
    const r = await ingest.execute({
      meta: {
        titulo: man.titulo,
        emisor: man.emisor,
        tipo: man.tipo,
        fecha: man.fecha ?? null,
        numero: man.numero,
        tema: man.tema,
        autoridad: man.autoridad ?? 'vinculante',
        url_original: man.url_original,
      },
      hash,
      chunks,
      onProgress: (m) => console.log(m),
    });
    if (r.duplicado) {
      console.log(`Ya existe: ${r.id} (${r.titulo}). Nada que hacer.`);
    } else {
      console.log(`OK doc=${r.docId} chunks=${r.chunks} dims=${r.dims}`);
      if (r.dims === 0) {
        console.log(
          'AVISO: sin vectores (solo FTS). Para vectores: EMBED_PROVIDER=gemini (+EMBED_API_KEY) u ollama + bge-m3.',
        );
      }
    }
  } finally {
    await app.close();
  }
}

void main();
