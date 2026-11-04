// CRUD de conversaciones con verificación de propiedad (404 si ajena).
// B5: asignación a proyectos. B9: compartir, buscar, exportar.
// B6: resolvedor unificado de citas (corpus público + archivos propios).
import { randomBytes } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { SearchDocuments } from '../../corpus';
import {
  CONVERSATION_REPOSITORY,
  ConversationRepository,
  MESSAGE_REPOSITORY,
  MessageRepository,
  PROJECT_REPOSITORY,
  ProjectRepository,
  SHARE_REPOSITORY,
  ShareRepository,
} from '../domain/repositories';
import { Conversation } from '../domain/conversation';
import { Project } from '../domain/project';
import { buildConversationMarkdown } from '../domain/export';
import {
  conversacionNoEncontrada,
  enlaceNoEncontrado,
  mensajeInvalido,
  proyectoNoEncontrado,
} from './errors';
import { ProjectFiles } from './project-files';

function pub(c: Conversation): Record<string, unknown> {
  const p = c.snapshot;
  return {
    id: p.id,
    title: p.title,
    project_id: p.projectId,
    archived: c.archived,
    created_at: p.createdAt.toISOString(),
    updated_at: p.updatedAt.toISOString(),
    summary: p.summary,
    summary_count: p.summaryCount,
    topics: p.topics,
  };
}

@Injectable()
export class Conversations {
  constructor(
    @Inject(CONVERSATION_REPOSITORY) private readonly convs: ConversationRepository,
    @Inject(MESSAGE_REPOSITORY) private readonly msgs: MessageRepository,
    @Inject(PROJECT_REPOSITORY) private readonly projects: ProjectRepository,
    @Inject(SHARE_REPOSITORY) private readonly shares: ShareRepository,
    private readonly corpus: SearchDocuments,
    private readonly pfiles: ProjectFiles,
  ) {}

  private async owned(userId: string, id: string): Promise<Conversation> {
    const row = await this.convs.findById(id);
    if (!row || row.userId !== userId) throw conversacionNoEncontrada();
    return Conversation.rehydrate(row);
  }

  private async ownedProject(userId: string, id: string): Promise<Project> {
    const row = await this.projects.findById(id);
    if (!row || row.userId !== userId) throw proyectoNoEncontrado();
    return Project.rehydrate(row);
  }

  async create(userId: string, title?: string): Promise<Record<string, unknown>> {
    const row = await this.convs.create(
      userId,
      (title ?? '').trim().slice(0, 120) || 'Nueva conversación',
      new Date(),
    );
    return pub(Conversation.rehydrate(row));
  }

  async list(
    userId: string,
    opts: { limit: number; offset: number; archived: boolean; projectId?: string },
  ): Promise<Record<string, unknown>> {
    if (opts.projectId) await this.ownedProject(userId, opts.projectId);
    const rows = await this.convs.listByUser(userId, opts);
    return { conversations: rows.map((r) => pub(Conversation.rehydrate(r))) };
  }

  async get(userId: string, id: string): Promise<Record<string, unknown>> {
    const c = await this.owned(userId, id);
    const messages = await this.msgs.listByConversation(id, { limit: 200 });
    return {
      conversation: pub(c),
      messages: messages.map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        citations: m.citations,
        model: m.model,
        created_at: m.createdAt.toISOString(),
      })),
    };
  }

  async update(
    userId: string,
    id: string,
    patch: { title?: string; archived?: boolean; projectId?: string | null },
  ): Promise<Record<string, unknown>> {
    const c = await this.owned(userId, id);
    const now = new Date();
    if (patch.title !== undefined) {
      try {
        c.rename(patch.title, now);
      } catch {
        throw mensajeInvalido('título inválido');
      }
    }
    if (patch.archived !== undefined) c.setArchived(patch.archived, now);
    if (patch.projectId !== undefined) {
      if (patch.projectId !== null) await this.ownedProject(userId, patch.projectId);
      c.moveToProject(patch.projectId, now);
    }
    await this.convs.save(c.snapshot);
    return pub(c);
  }

  async remove(userId: string, id: string): Promise<{ message: string }> {
    await this.owned(userId, id);
    await this.convs.delete(id);
    return { message: 'conversación eliminada' };
  }

  /** B9: un enlace activo por conversación (reutiliza el vigente). */
  async share(userId: string, id: string): Promise<Record<string, unknown>> {
    await this.owned(userId, id);
    const active = await this.shares.findActiveByConversation(id);
    if (active) return { token: active.token, path: `/chat/shared/${active.token}` };
    const token = `lex_${randomBytes(18).toString('base64url')}`;
    const created = await this.shares.create(id, token);
    return { token: created.token, path: `/chat/shared/${created.token}` };
  }

  async unshare(userId: string, id: string): Promise<{ revoked: number }> {
    await this.owned(userId, id);
    const n = await this.shares.revokeByConversation(id, new Date());
    return { revoked: n };
  }

  /** B9: lectura pública por token (sin ids internos, costos ni modelos). */
  async getShared(token: string): Promise<Record<string, unknown>> {
    const link = await this.shares.findActiveByToken(token);
    if (!link) throw enlaceNoEncontrado();
    const row = await this.convs.findById(link.conversationId);
    if (!row) throw enlaceNoEncontrado();
    const messages = await this.msgs.listByConversation(row.id, { limit: 200 });
    return {
      conversation: { title: row.title, created_at: row.createdAt.toISOString() },
      messages: messages.map((m) => ({
        role: m.role,
        content: m.content,
        citations: m.citations.map((c) => ({
          n: c.n,
          ruta: c.ruta,
          titulo: c.titulo,
        })),
      })),
    };
  }

  async search(
    userId: string,
    q: string,
    limit: number,
  ): Promise<Record<string, unknown>> {
    const query = q.trim().slice(0, 200);
    if (query.length < 2) throw mensajeInvalido('búsqueda muy corta (mín. 2)');
    const hits = await this.msgs.searchByUser(userId, query, limit);
    return {
      q: query,
      count: hits.length,
      hits: hits.map((h) => ({
        message_id: h.messageId,
        conversation_id: h.conversationId,
        title: h.title,
        role: h.role,
        snippet: h.snippet,
        created_at: h.createdAt.toISOString(),
      })),
    };
  }

  async exportMarkdown(userId: string, id: string): Promise<Record<string, unknown>> {
    const c = await this.owned(userId, id);
    const snap = c.snapshot;
    const messages = await this.msgs.listByConversation(id, { limit: 500 });
    let projectName: string | null = null;
    if (snap.projectId) {
      const p = await this.projects.findById(snap.projectId);
      if (p && p.userId === userId) projectName = p.name;
    }
    const markdown = buildConversationMarkdown({
      title: snap.title,
      projectName,
      exportedAt: new Date(),
      messages,
    });
    return {
      filename: `lex-${snap.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'conversacion'}.md`,
      markdown,
    };
  }

  /** B6: resuelve una cita venga del corpus (público) o de un archivo propio. */
  async getCita(userId: string, chunkId: string): Promise<Record<string, unknown>> {
    const c = await this.corpus.chunk(chunkId);
    if (c) return { ...c, fuente: 'corpus' };
    return this.pfiles.getChunk(userId, chunkId);
  }
}
