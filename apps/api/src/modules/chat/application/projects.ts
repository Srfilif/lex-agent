// CRUD de proyectos (B5) con verificación de propiedad (404 si ajeno).
import { Inject, Injectable } from '@nestjs/common';
import {
  CONVERSATION_REPOSITORY,
  ConversationRepository,
  PROJECT_REPOSITORY,
  ProjectRepository,
} from '../domain/repositories';
import { Conversation } from '../domain/conversation';
import { Project } from '../domain/project';
import { mensajeInvalido, proyectoNoEncontrado } from './errors';

function pubProject(p: Project, conversationCount?: number): Record<string, unknown> {
  const s = p.snapshot;
  return {
    id: s.id,
    name: s.name,
    instructions: s.instructions,
    ...(conversationCount === undefined ? {} : { conversation_count: conversationCount }),
    created_at: s.createdAt.toISOString(),
    updated_at: s.updatedAt.toISOString(),
  };
}

function pubConv(c: Conversation): Record<string, unknown> {
  const p = c.snapshot;
  return {
    id: p.id,
    title: p.title,
    project_id: p.projectId,
    archived: c.archived,
    created_at: p.createdAt.toISOString(),
    updated_at: p.updatedAt.toISOString(),
  };
}

@Injectable()
export class Projects {
  constructor(
    @Inject(PROJECT_REPOSITORY) private readonly projects: ProjectRepository,
    @Inject(CONVERSATION_REPOSITORY) private readonly convs: ConversationRepository,
  ) {}

  private async owned(userId: string, id: string): Promise<Project> {
    const row = await this.projects.findById(id);
    if (!row || row.userId !== userId) throw proyectoNoEncontrado();
    return Project.rehydrate(row);
  }

  async create(
    userId: string,
    input: { name: string; instructions?: string },
  ): Promise<Record<string, unknown>> {
    const name = (input.name ?? '').trim().replace(/\s+/g, ' ').slice(0, 120);
    if (!name) throw mensajeInvalido('nombre inválido');
    const instructions = (input.instructions ?? '').trim().slice(0, 4000);
    const row = await this.projects.create(userId, name, instructions, new Date());
    return pubProject(Project.rehydrate(row), 0);
  }

  async list(userId: string): Promise<Record<string, unknown>> {
    const rows = await this.projects.listByUser(userId);
    return {
      projects: rows.map((r) =>
        pubProject(Project.rehydrate(r), r.conversationCount),
      ),
    };
  }

  async get(userId: string, id: string): Promise<Record<string, unknown>> {
    const p = await this.owned(userId, id);
    const convs = await this.convs.listByUser(userId, {
      limit: 100,
      offset: 0,
      archived: false,
      projectId: id,
    });
    return {
      project: pubProject(p, convs.length),
      conversations: convs.map((r) => pubConv(Conversation.rehydrate(r))),
    };
  }

  async update(
    userId: string,
    id: string,
    patch: { name?: string; instructions?: string },
  ): Promise<Record<string, unknown>> {
    const p = await this.owned(userId, id);
    const now = new Date();
    if (patch.name !== undefined) {
      try {
        p.rename(patch.name, now);
      } catch {
        throw mensajeInvalido('nombre inválido');
      }
    }
    if (patch.instructions !== undefined) p.setInstructions(patch.instructions, now);
    await this.projects.save(p.snapshot);
    return pubProject(p);
  }

  async remove(userId: string, id: string): Promise<{ message: string }> {
    await this.owned(userId, id);
    await this.projects.delete(id);
    return { message: 'proyecto eliminado' };
  }
}
