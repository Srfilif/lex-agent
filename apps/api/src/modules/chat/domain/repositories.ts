// Puertos de persistencia del chat.
import { Citation, ConversationProps, MessageProps } from './conversation';
import { ProjectProps, ShareLinkProps } from './project';
import { ProjectChunkProps, ProjectFileProps } from './project-files';

export const CONVERSATION_REPOSITORY = Symbol('CONVERSATION_REPOSITORY');
export const MESSAGE_REPOSITORY = Symbol('MESSAGE_REPOSITORY');
export const PROJECT_REPOSITORY = Symbol('PROJECT_REPOSITORY');
export const SHARE_REPOSITORY = Symbol('SHARE_REPOSITORY');
export const PROJECT_FILE_REPOSITORY = Symbol('PROJECT_FILE_REPOSITORY');

export interface ConversationRepository {
  create(userId: string, title: string, now: Date): Promise<ConversationProps>;
  findById(id: string): Promise<ConversationProps | null>;
  listByUser(
    userId: string,
    opts: { limit: number; offset: number; archived: boolean; projectId?: string },
  ): Promise<ConversationProps[]>;
  save(c: ConversationProps): Promise<void>;
  delete(id: string): Promise<void>;
}

export interface MessageRepository {
  append(m: {
    conversationId: string;
    role: 'user' | 'assistant';
    content: string;
    citations?: Citation[];
    usage?: { prompt: number; completion: number; total: number } | null;
    costUsd?: number | null;
    model?: string | null;
  }): Promise<MessageProps>;
  listByConversation(
    conversationId: string,
    opts: { limit: number },
  ): Promise<MessageProps[]>;
  countByConversation(conversationId: string): Promise<number>;
  deleteById(id: string): Promise<void>;
  searchByUser(
    userId: string,
    q: string,
    limit: number,
  ): Promise<
    Array<{
      messageId: string;
      conversationId: string;
      title: string;
      role: string;
      snippet: string;
      createdAt: Date;
    }>
  >;
}

export interface ProjectRepository {
  create(userId: string, name: string, instructions: string, now: Date): Promise<ProjectProps>;
  findById(id: string): Promise<ProjectProps | null>;
  listByUser(userId: string): Promise<Array<ProjectProps & { conversationCount: number }>>;
  save(p: ProjectProps): Promise<void>;
  delete(id: string): Promise<void>;
}

export interface ShareRepository {
  findActiveByConversation(conversationId: string): Promise<ShareLinkProps | null>;
  create(conversationId: string, token: string): Promise<ShareLinkProps>;
  revokeByConversation(conversationId: string, now: Date): Promise<number>;
  findActiveByToken(token: string): Promise<ShareLinkProps | null>;
}

export interface NuevoProjectChunk {
  n: number;
  ruta: string;
  texto: string;
  textoContexto: string;
  embedding: number[];
}

export interface ProjectChunkHit extends ProjectChunkProps {
  filename: string;
  score: number;
  metodo: 'hibrido';
}

export interface ProjectFileRepository {
  create(f: {
    projectId: string;
    userId: string;
    filename: string;
    mime: string;
    sizeBytes: number;
    sha256: string;
    storagePath: string;
    chunkCount: number;
    sospechoso: boolean;
  }): Promise<ProjectFileProps>;
  findById(id: string): Promise<ProjectFileProps | null>;
  findByProjectAndHash(projectId: string, sha256: string): Promise<ProjectFileProps | null>;
  listByProject(projectId: string): Promise<ProjectFileProps[]>;
  /** Storage: todos los archivos del usuario con nombre del proyecto. */
  listByUser(userId: string): Promise<Array<ProjectFileProps & { projectName: string }>>;
  usageByProject(projectId: string): Promise<{ count: number; bytes: number }>;
  saveChunks(fileId: string, projectId: string, chunks: NuevoProjectChunk[]): Promise<void>;
  delete(id: string): Promise<void>;
  ftsRanked(projectId: string, q: string, limit: number): Promise<string[]>;
  vectorRanked(projectId: string, embedding: number[], limit: number): Promise<string[]>;
  chunksByIds(ids: string[]): Promise<ProjectChunkHit[]>;
  chunkById(chunkId: string): Promise<(ProjectChunkHit & { userId: string }) | null>;
}
