// Repositorios pg de conversaciones y mensajes.
import { Injectable } from '@nestjs/common';
import { Db } from '../../../../db';
import {
  Citation,
  ConversationProps,
  MessageProps,
  MessageRole,
} from '../../domain/conversation';
import {
  ConversationRepository,
  MessageRepository,
  ProjectRepository,
  ShareRepository,
} from '../../domain/repositories';
import { ProjectProps, ShareLinkProps } from '../../domain/project';
import { asDate, asDateOrNull, asJson, asStringArray } from '../../../../shared/db/dialect';
import { escapeLike } from '../../../../shared/sql';

interface ConvRow {
  id: string;
  user_id: string;
  title: string;
  project_id: string | null;
  created_at: Date;
  updated_at: Date;
  archived_at: Date | null;
  summary: string | null;
  summary_count: number;
  topics: string[];
}

interface MsgRow {
  id: string;
  conversation_id: string;
  role: string;
  content: string;
  citations: Citation[];
  usage: MessageProps['usage'];
  cost_usd: string | number | null;
  model: string | null;
  created_at: Date;
}

@Injectable()
export class PgConversationRepository implements ConversationRepository {
  constructor(private readonly db: Db) {}

  async create(userId: string, title: string, now: Date): Promise<ConversationProps> {
    const r = await this.db.raw.query(
      `INSERT INTO conversations (user_id, title, created_at, updated_at)
       VALUES ($1, $2, $3, $3) RETURNING *`,
      [userId, title, now],
    );
    return toConv(r.rows[0] as ConvRow);
  }

  async findById(id: string): Promise<ConversationProps | null> {
    const r = await this.db.raw.query('SELECT * FROM conversations WHERE id = $1', [id]);
    if (!r.rowCount) return null;
    return toConv(r.rows[0] as ConvRow);
  }

  async listByUser(
    userId: string,
    opts: { limit: number; offset: number; archived: boolean; projectId?: string },
  ): Promise<ConversationProps[]> {
    const limit = Math.min(Math.max(Math.trunc(opts.limit) || 20, 1), 100);
    const offset = Math.max(Math.trunc(opts.offset) || 0, 0);
    const params: unknown[] = [userId];
    let proj = '';
    if (opts.projectId) {
      params.push(opts.projectId);
      proj = ` AND project_id = $2`;
    }
    const r = await this.db.raw.query(
      `SELECT * FROM conversations WHERE user_id = $1
       AND archived_at IS ${opts.archived ? 'NOT NULL' : 'NULL'}${proj}
       ORDER BY updated_at DESC LIMIT ${limit} OFFSET ${offset}`,
      params,
    );
    return (r.rows as ConvRow[]).map(toConv);
  }

  async save(c: ConversationProps): Promise<void> {
    await this.db.raw.query(
      `UPDATE conversations SET title = $2, updated_at = $3, archived_at = $4,
       project_id = $5, summary = $6, summary_count = $7, topics = $8 WHERE id = $1`,
      [c.id, c.title, c.updatedAt, c.archivedAt, c.projectId, c.summary, c.summaryCount, c.topics],
    );
  }

  async delete(id: string): Promise<void> {
    await this.db.raw.query('DELETE FROM conversations WHERE id = $1', [id]);
  }
}

function toConv(r: ConvRow): ConversationProps {
  return {
    id: r.id,
    userId: r.user_id,
    title: r.title,
    projectId: r.project_id,
    createdAt: asDate(r.created_at),
    updatedAt: asDate(r.updated_at),
    archivedAt: asDateOrNull(r.archived_at),
    summary: r.summary,
    summaryCount: r.summary_count ?? 0,
    topics: asStringArray(r.topics),
  };
}

@Injectable()
export class PgMessageRepository implements MessageRepository {
  constructor(private readonly db: Db) {}

  async append(m: {
    conversationId: string;
    role: 'user' | 'assistant';
    content: string;
    citations?: Citation[];
    usage?: { prompt: number; completion: number; total: number } | null;
    costUsd?: number | null;
    model?: string | null;
  }): Promise<MessageProps> {
    const r = await this.db.raw.query(
      `INSERT INTO messages (conversation_id, role, content, citations, usage, cost_usd, model)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [
        m.conversationId,
        m.role,
        m.content,
        JSON.stringify(m.citations ?? []),
        m.usage ? JSON.stringify(m.usage) : null,
        m.costUsd ?? null,
        m.model ?? null,
      ],
    );
    return toMsg(r.rows[0] as MsgRow);
  }

  async listByConversation(
    conversationId: string,
    opts: { limit: number },
  ): Promise<MessageProps[]> {
    const limit = Math.min(Math.max(Math.trunc(opts.limit) || 200, 1), 500);
    const r = await this.db.raw.query(
      `SELECT * FROM messages WHERE conversation_id = $1
       ORDER BY created_at ASC, id ASC LIMIT ${limit}`,
      [conversationId],
    );
    return (r.rows as MsgRow[]).map(toMsg);
  }

  async countByConversation(conversationId: string): Promise<number> {
    const r = await this.db.raw.query(
      'SELECT CAST(count(*) AS INTEGER) AS n FROM messages WHERE conversation_id = $1',
      [conversationId],
    );
    return (r.rows[0] as { n: number }).n;
  }

  async deleteById(id: string): Promise<void> {
    await this.db.raw.query('DELETE FROM messages WHERE id = $1', [id]);
  }

  async searchByUser(
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
  > {
    const lim = Math.min(Math.max(Math.trunc(limit) || 20, 1), 50);
    // Fragmento centrado en la coincidencia (~60 chars antes, 240 total).
    const snippetExpr = this.db.isSqlite
      ? 'substr(m.content, max(instr(lower(m.content), lower($2)) - 60, 1), 240) AS snippet'
      : `substring(m.content from greatest(position(lower($2) in lower(m.content)) - 60, 1) for 240) AS snippet`;
    const matchOp = this.db.isSqlite ? 'LIKE' : 'ILIKE';
    const r = await this.db.raw.query(
      `SELECT m.id AS message_id, m.conversation_id, c.title, m.role, m.created_at,
       ${snippetExpr}
       FROM messages m JOIN conversations c ON c.id = m.conversation_id
       WHERE c.user_id = $1 AND ${this.db.isSqlite ? 'LOWER(m.content)' : 'm.content'} ${matchOp} '%' || $3 || '%' ESCAPE '\\'
       ORDER BY m.created_at DESC LIMIT ${lim}`,
      [userId, q, this.db.isSqlite ? escapeLike(q).toLowerCase() : escapeLike(q)],
    );
    return (r.rows as Array<Record<string, string | Date>>).map((row) => ({
      messageId: String(row['message_id']),
      conversationId: String(row['conversation_id']),
      title: String(row['title']),
      role: String(row['role']),
      snippet: String(row['snippet']),
      createdAt: asDate(row['created_at']),
    }));
  }
}

function toMsg(r: MsgRow): MessageProps {
  return {
    id: r.id,
    conversationId: r.conversation_id,
    role: r.role as MessageRole,
    content: r.content,
    citations: asJson<Citation[]>(r.citations, []),
    usage: asJson<MessageProps['usage']>(r.usage, null),
    costUsd: r.cost_usd === null ? null : Number(r.cost_usd),
    model: r.model,
    createdAt: asDate(r.created_at),
  };
}

interface ProjRow {
  id: string;
  user_id: string;
  name: string;
  instructions: string;
  created_at: Date;
  updated_at: Date;
  conversation_count?: string | number;
}

function toProj(r: ProjRow): ProjectProps {
  return {
    id: r.id,
    userId: r.user_id,
    name: r.name,
    instructions: r.instructions,
    createdAt: asDate(r.created_at),
    updatedAt: asDate(r.updated_at),
  };
}

@Injectable()
export class PgProjectRepository implements ProjectRepository {
  constructor(private readonly db: Db) {}

  async create(userId: string, name: string, instructions: string, now: Date): Promise<ProjectProps> {
    const r = await this.db.raw.query(
      `INSERT INTO projects (user_id, name, instructions, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $4) RETURNING *`,
      [userId, name, instructions, now],
    );
    return toProj(r.rows[0] as ProjRow);
  }

  async findById(id: string): Promise<ProjectProps | null> {
    const r = await this.db.raw.query('SELECT * FROM projects WHERE id = $1', [id]);
    if (!r.rowCount) return null;
    return toProj(r.rows[0] as ProjRow);
  }

  async listByUser(userId: string): Promise<Array<ProjectProps & { conversationCount: number }>> {
    const r = await this.db.raw.query(
      `SELECT p.*, CAST(count(c.id) AS INTEGER) AS conversation_count FROM projects p
       LEFT JOIN conversations c ON c.project_id = p.id AND c.archived_at IS NULL
       WHERE p.user_id = $1 GROUP BY p.id ORDER BY p.updated_at DESC`,
      [userId],
    );
    return (r.rows as ProjRow[]).map((row) => ({
      ...toProj(row),
      conversationCount: Number(row.conversation_count ?? 0),
    }));
  }

  async save(p: ProjectProps): Promise<void> {
    await this.db.raw.query(
      'UPDATE projects SET name = $2, instructions = $3, updated_at = $4 WHERE id = $1',
      [p.id, p.name, p.instructions, p.updatedAt],
    );
  }

  async delete(id: string): Promise<void> {
    await this.db.raw.query('DELETE FROM projects WHERE id = $1', [id]);
  }
}

interface ShareRow {
  id: string;
  conversation_id: string;
  token: string;
  created_at: Date;
  revoked_at: Date | null;
}

function toShare(r: ShareRow): ShareLinkProps {
  return {
    id: r.id,
    conversationId: r.conversation_id,
    token: r.token,
    createdAt: asDate(r.created_at),
    revokedAt: asDateOrNull(r.revoked_at),
  };
}

@Injectable()
export class PgShareRepository implements ShareRepository {
  constructor(private readonly db: Db) {}

  async findActiveByConversation(conversationId: string): Promise<ShareLinkProps | null> {
    const r = await this.db.raw.query(
      `SELECT * FROM share_links
       WHERE conversation_id = $1 AND revoked_at IS NULL
       ORDER BY created_at DESC LIMIT 1`,
      [conversationId],
    );
    if (!r.rowCount) return null;
    return toShare(r.rows[0] as ShareRow);
  }

  async create(conversationId: string, token: string): Promise<ShareLinkProps> {
    const r = await this.db.raw.query(
      'INSERT INTO share_links (conversation_id, token) VALUES ($1, $2) RETURNING *',
      [conversationId, token],
    );
    return toShare(r.rows[0] as ShareRow);
  }

  async revokeByConversation(conversationId: string, now: Date): Promise<number> {
    const r = await this.db.raw.query(
      `UPDATE share_links SET revoked_at = $2
       WHERE conversation_id = $1 AND revoked_at IS NULL`,
      [conversationId, now],
    );
    return r.rowCount ?? 0;
  }

  async findActiveByToken(token: string): Promise<ShareLinkProps | null> {
    const r = await this.db.raw.query(
      'SELECT * FROM share_links WHERE token = $1 AND revoked_at IS NULL',
      [token],
    );
    if (!r.rowCount) return null;
    return toShare(r.rows[0] as ShareRow);
  }
}
