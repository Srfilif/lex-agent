// Entidades del chat: conversación + mensaje + historial podado.
// Puro: sin Nest/SQL/HTTP/gateway (HistoryMsg es forma propia del dominio).

export type MessageRole = 'user' | 'assistant';

export interface Citation {
  n: number;
  chunk_id: string | null;
  secop_ref: string | null;
  ruta: string;
  titulo: string;
}

export interface MessageProps {
  id: string;
  conversationId: string;
  role: MessageRole;
  content: string;
  citations: Citation[];
  usage: { prompt: number; completion: number; total: number } | null;
  costUsd: number | null;
  model: string | null;
  createdAt: Date;
}

export interface ConversationProps {
  id: string;
  userId: string;
  title: string;
  projectId: string | null;
  createdAt: Date;
  updatedAt: Date;
  archivedAt: Date | null;
  /** B8: resumen rodante de los `summaryCount` mensajes más antiguos (o null). */
  summary: string | null;
  summaryCount: number;
  /** B11: temas cortos detectados junto al título (máx. 5). */
  topics: string[];
}

export class Conversation {
  private constructor(private p: ConversationProps) {}

  static rehydrate(p: ConversationProps): Conversation {
    return new Conversation({ ...p });
  }

  get snapshot(): ConversationProps {
    return { ...this.p };
  }

  get id(): string {
    return this.p.id;
  }

  get userId(): string {
    return this.p.userId;
  }

  get archived(): boolean {
    return this.p.archivedAt !== null;
  }

  rename(title: string, now: Date): void {
    const t = title.trim().replace(/\s+/g, ' ').slice(0, 120);
    if (!t) throw new Error('título vacío');
    this.p.title = t;
    this.p.updatedAt = now;
  }

  setArchived(archived: boolean, now: Date): void {
    this.p.archivedAt = archived ? now : null;
    this.p.updatedAt = now;
  }

  moveToProject(projectId: string | null, now: Date): void {
    this.p.projectId = projectId;
    this.p.updatedAt = now;
  }

  get summary(): string | null {
    return this.p.summary;
  }

  get summaryCount(): number {
    return this.p.summaryCount;
  }

  /** B8: aplica un resumen que cubre `count` mensajes antiguos (monótono). */
  applySummary(summary: string, count: number, now: Date): void {
    const s = summary.trim().slice(0, 4000);
    if (!s) throw new Error('resumen vacío');
    if (!Number.isInteger(count) || count <= this.p.summaryCount) {
      throw new Error('resumen no avanza');
    }
    this.p.summary = s;
    this.p.summaryCount = count;
    this.p.updatedAt = now;
  }

  /** B11: fija temas (sanea, dedup, máx. 5 de 40 chars). Vacío = no-op. */
  setTopics(topics: string[], now: Date): void {
    const clean = [...new Set(topics.map((t) => t.trim().replace(/\s+/g, ' ').slice(0, 40)).filter(Boolean))].slice(0, 5);
    if (!clean.length) return;
    this.p.topics = clean;
    this.p.updatedAt = now;
  }

  touch(now: Date): void {
    this.p.updatedAt = now;
  }
}

export interface HistoryMsg {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/**
 * Ventana de contexto: system + [resumen] + últimos mensajes que quepan.
 * B8: el resumen (si hay) viaja como 2.º mensaje de sistema y consume del
 * mismo presupuesto; los mensajes ya resumidos no deben incluirse en `messages`.
 */
export function buildHistory(
  system: string,
  messages: Array<{ role: MessageRole; content: string }>,
  maxChars: number,
  summary?: string | null,
): HistoryMsg[] {
  const out: HistoryMsg[] = [{ role: 'system', content: system }];
  let used = system.length;
  const s = (summary ?? '').trim();
  if (s) {
    const capped = s.slice(0, 4000);
    out.push({ role: 'system', content: `Resumen de la conversación hasta ahora:\n${capped}` });
    used += capped.length;
  }
  const kept: HistoryMsg[] = [];
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i] as { role: MessageRole; content: string };
    if (used + m.content.length > maxChars && kept.length > 0) break;
    used += m.content.length;
    kept.unshift({ role: m.role, content: m.content });
  }
  return out.concat(kept);
}
