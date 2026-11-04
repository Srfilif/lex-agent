import { Inject, Injectable } from '@nestjs/common';
import { Chunk } from '../domain/chunk';
import { CORPUS_REPOSITORY, CorpusRepository, NuevoDocumento } from '../domain/repositories';
import { EMBEDDING_PORT, EmbeddingPort } from './ports';

export interface IngestaEntrada {
  meta: Omit<NuevoDocumento, 'hash'>;
  hash: string;
  chunks: Chunk[];
  onProgress?: (msg: string) => void;
}

export type IngestaSalida =
  | { duplicado: true; id: string; titulo: string }
  | { duplicado: false; docId: string; chunks: number; dims: number };

// Caso de uso: ingesta idempotente (hash → embed → guardado transaccional).
@Injectable()
export class IngestDocument {
  constructor(
    @Inject(CORPUS_REPOSITORY) private readonly repo: CorpusRepository,
    @Inject(EMBEDDING_PORT) private readonly embeddings: EmbeddingPort,
  ) {}

  async execute(input: IngestaEntrada): Promise<IngestaSalida> {
    const dup = await this.repo.findDocumentByHash(input.hash);
    if (dup) return { duplicado: true, id: dup.id, titulo: dup.titulo };
    input.onProgress?.(`Embebiendo ${input.chunks.length} chunks...`);
    const vecs = await this.embeddings.embed(
      input.chunks.map((c) => `${c.texto_contexto}\n${c.texto}`.slice(0, 8000)),
    );
    const saved = await this.repo.saveDocumentWithChunks(
      { ...input.meta, hash: input.hash },
      input.chunks.map((c, i) => ({
        ruta: c.ruta,
        offset_inicio: c.offset_inicio,
        offset_fin: c.offset_fin,
        texto: c.texto,
        texto_contexto: c.texto_contexto,
        embedding: vecs[i],
      })),
    );
    return { duplicado: false, docId: saved.docId, chunks: saved.chunks, dims: vecs[0]?.length ?? 0 };
  }
}
