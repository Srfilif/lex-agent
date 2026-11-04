// Archivos de usuario por proyecto (B6): upload síncrono + parse + chunk +
// embeddings + FTS/híbrido con aislamiento por proyecto (regla: propiedad).
import { createHash } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { FILE_STORAGE, FileStorage } from './ports';
import {
  EMBEDDING_PORT,
  EmbeddingPort,
  chunkNorma,
  fuseRrf,
  normalizeText,
} from '../../corpus';
import {
  PROJECT_FILE_REPOSITORY,
  PROJECT_REPOSITORY,
  ProjectFileRepository,
  ProjectRepository,
} from '../domain/repositories';
import {
  ALLOWED_EXTENSIONS,
  MAX_BYTES_PER_PROJECT,
  MAX_CHUNKS_PER_FILE,
  MAX_FILES_PER_PROJECT,
  MAX_FILE_BYTES,
  ProjectFile,
  cleanFilename,
  extensionOf,
  extractText,
  isAllowedFile,
  quotaError,
} from '../domain/project-files';
import { scanInjection } from '../domain/guardrails';
import {
  archivoInvalido,
  archivoMuyGrande,
  archivoNoEncontrado,
  cuotaArchivos,
  embeddingsNoDisponibles,
  enlaceNoEncontrado,
  proyectoNoEncontrado,
} from './errors';

const ADVERTENCIA_INYECCION =
  'el archivo contiene texto que parece una instrucción para el asistente; ' +
  'se indexó igual, pero el asistente lo tratará solo como datos';

function pub(f: ProjectFile): Record<string, unknown> {
  const p = f.snapshot;
  return {
    id: p.id,
    project_id: p.projectId,
    filename: p.filename,
    mime: p.mime,
    size_bytes: p.sizeBytes,
    chunk_count: p.chunkCount,
    status: p.status,
    error: p.error,
    sospechoso: p.sospechoso,
    created_at: p.createdAt.toISOString(),
  };
}

@Injectable()
export class ProjectFiles {
  constructor(
    @Inject(PROJECT_REPOSITORY) private readonly projects: ProjectRepository,
    @Inject(PROJECT_FILE_REPOSITORY) private readonly files: ProjectFileRepository,
    @Inject(EMBEDDING_PORT) private readonly embeddings: EmbeddingPort,
    @Inject(FILE_STORAGE) private readonly storage: FileStorage,
  ) {}

  private async ownedProject(userId: string, projectId: string): Promise<void> {
    const row = await this.projects.findById(projectId);
    if (!row || row.userId !== userId) throw proyectoNoEncontrado();
  }

  private async ownedFile(userId: string, id: string): Promise<ProjectFile> {
    const row = await this.files.findById(id);
    if (!row || row.userId !== userId) throw archivoNoEncontrado();
    return ProjectFile.rehydrate(row);
  }

  /** Upload síncrono (archivos ≤10MB): valida → parse → embed → disco → DB. */
  async upload(
    userId: string,
    projectId: string,
    input: { originalname: string; mimetype: string; size: number; buffer: Buffer },
  ): Promise<Record<string, unknown>> {
    await this.ownedProject(userId, projectId);
    let filename: string;
    try {
      filename = cleanFilename(input.originalname);
    } catch {
      throw archivoInvalido('nombre inválido');
    }
    if (!isAllowedFile(filename)) {
      throw archivoInvalido(`solo se aceptan ${ALLOWED_EXTENSIONS.join(', ')} (PDF/DOCX pendientes)`);
    }
    if (input.size > MAX_FILE_BYTES || input.buffer.length > MAX_FILE_BYTES) {
      throw archivoMuyGrande(`máximo ${MAX_FILE_BYTES / 1024 / 1024} MB por archivo`);
    }
    const usage = await this.files.usageByProject(projectId);
    if (usage.count >= MAX_FILES_PER_PROJECT) throw cuotaArchivos(quotaError('count'));
    if (usage.bytes + input.buffer.length > MAX_BYTES_PER_PROJECT) {
      throw cuotaArchivos(quotaError('bytes'));
    }
    const sha256 = createHash('sha256').update(input.buffer).digest('hex');
    const dup = await this.files.findByProjectAndHash(projectId, sha256);
    if (dup) {
      const out: Record<string, unknown> = { duplicado: true, file: pub(ProjectFile.rehydrate(dup)) };
      if (dup.sospechoso) out['advertencia'] = ADVERTENCIA_INYECCION;
      return out;
    }

    let text: string;
    try {
      text = extractText(input.buffer);
    } catch (e) {
      throw archivoInvalido((e as Error).message);
    }
    // B10: scan anti-inyección (aviso, no bloqueo).
    const sospechoso = scanInjection(text);
    const chunks = chunkNorma(normalizeText(text), filename).slice(0, MAX_CHUNKS_PER_FILE);
    if (!chunks.length) throw archivoInvalido('sin contenido aprovechable');
    let vecs: number[][];
    try {
      vecs = await this.embeddings.embed(
        chunks.map((c) => `${c.texto_contexto}\n${c.texto}`.slice(0, 8000)),
      );
    } catch {
      throw embeddingsNoDisponibles();
    }
    const storagePath = `${sha256}${extensionOf(filename)}`;
    let wrote = false;
    try {
      await this.storage.write(storagePath, input.buffer);
      wrote = true;
      const row = await this.files.create({
        projectId,
        userId,
        filename,
        mime: input.mimetype || 'text/plain',
        sizeBytes: input.buffer.length,
        sha256,
        storagePath,
        chunkCount: chunks.length,
        sospechoso,
      });
      await this.files.saveChunks(
        row.id,
        projectId,
        chunks.map((c, i) => ({
          n: i + 1,
          ruta: c.ruta,
          texto: c.texto,
          textoContexto: c.texto_contexto,
          embedding: vecs[i] ?? [],
        })),
      );
      const out: Record<string, unknown> = { duplicado: false, file: pub(ProjectFile.rehydrate(row)) };
      if (sospechoso) out['advertencia'] = ADVERTENCIA_INYECCION;
      return out;
    } catch (e) {
      if (wrote) {
        await this.storage.remove(storagePath);
      }
      throw e;
    }
  }

  async list(userId: string, projectId: string): Promise<Record<string, unknown>> {
    await this.ownedProject(userId, projectId);
    const rows = await this.files.listByProject(projectId);
    const usage = await this.files.usageByProject(projectId);
    return {
      files: rows.map((r) => pub(ProjectFile.rehydrate(r))),
      usage: {
        count: usage.count,
        bytes: usage.bytes,
        max_files: MAX_FILES_PER_PROJECT,
        max_bytes: MAX_BYTES_PER_PROJECT,
      },
    };
  }

  /** Storage: todos los archivos del usuario + totales globales. */
  async listAll(userId: string): Promise<Record<string, unknown>> {
    const rows = await this.files.listByUser(userId);
    const files: Array<Record<string, unknown>> = rows.map((r) => ({
      ...pub(ProjectFile.rehydrate(r)),
      project_id: r.projectId,
      project_name: r.projectName,
    }));
    return {
      files,
      usage: {
        count: files.length,
        bytes: files.reduce((a, f) => a + (f.size_bytes as number), 0),
      },
    };
  }

  /** Descarga el original (propiedad verificada). */
  async download(
    userId: string,
    fileId: string,
  ): Promise<{ filename: string; mime: string; size: number; buffer: Buffer }> {
    const f = await this.ownedFile(userId, fileId);
    const p = f.snapshot;
    try {
      const buffer = await this.storage.read(p.storagePath);
      return { filename: p.filename, mime: p.mime, size: buffer.length, buffer };
    } catch {
      throw archivoNoEncontrado();
    }
  }

  async remove(userId: string, projectId: string, fileId: string): Promise<{ message: string }> {
    await this.ownedProject(userId, projectId);
    const f = await this.ownedFile(userId, fileId);
    if (f.snapshot.projectId !== projectId) throw archivoNoEncontrado();
    await this.files.delete(fileId);
    await this.storage.remove(f.snapshot.storagePath);
    return { message: 'archivo eliminado' };
  }

  /** Búsqueda híbrida FTS+vector con RRF, aislada al proyecto. */
  async search(
    userId: string,
    projectId: string,
    q: string,
    topK: number,
  ): Promise<Array<{ chunk_id: string; ruta: string; texto: string; filename: string; score: number }>> {
    await this.ownedProject(userId, projectId);
    const query = q.trim().slice(0, 500);
    if (query.length < 2) throw archivoInvalido('búsqueda muy corta (mín. 2)');
    const top = Math.min(Math.max(Math.trunc(topK) || 8, 1), 20);
    let vec: number[][];
    try {
      vec = await this.embeddings.embed([query]);
    } catch {
      throw embeddingsNoDisponibles();
    }
    const [ftsIds, vecIds] = await Promise.all([
      this.files.ftsRanked(projectId, query, 20),
      this.files.vectorRanked(projectId, vec[0] ?? [], 20),
    ]);
    const fused = fuseRrf(ftsIds, vecIds, new Set(), top);
    if (!fused.length) return [];
    const rows = await this.files.chunksByIds(fused.map((f) => f.id));
    const byId = new Map(rows.map((r) => [r.chunkId, r]));
    return fused.flatMap((f) => {
      const r = byId.get(f.id);
      return r
        ? [{ chunk_id: r.chunkId, ruta: `${r.filename} > ${r.ruta}`, texto: r.texto, filename: r.filename, score: f.score }]
        : [];
    });
  }

  /** Fragmento de proyecto con verificación de propiedad (visor de citas). */
  async getChunk(userId: string, chunkId: string): Promise<Record<string, unknown>> {
    const c = await this.files.chunkById(chunkId);
    if (!c || c.userId !== userId) throw enlaceNoEncontrado();
    return {
      chunk_id: c.chunkId,
      ruta: `${c.filename} > ${c.ruta}`,
      texto: c.texto,
      texto_contexto: c.textoContexto,
      filename: c.filename,
      fuente: 'proyecto',
    };
  }
}
