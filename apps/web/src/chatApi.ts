import { AuthHttpError, authFetch, authJson, getAccess, getRefresh, mensajeError } from './auth';
import { API } from './api';

export interface Citation {
  n: number;
  chunk_id: string | null;
  secop_ref: string | null;
  ruta: string;
  titulo: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  citations: Citation[];
  model: string | null;
  created_at: string;
  costo_usd?: number | null;
  tools?: string[];
  pending?: boolean;
  error?: string | null;
}

export interface Conversation {
  id: string;
  title: string;
  project_id: string | null;
  archived: boolean;
  created_at: string;
  updated_at: string;
  /** B11: temas detectados (puede ausentarse en respuestas viejas). */
  topics?: string[];
}

interface ConversationRaw {
  id: string;
  title: string;
  project_id?: string | null;
  archived?: boolean;
  archived_at?: string | null;
  created_at: string;
  updated_at: string;
  topics?: string[];
}

function normalizarConversacion(r: ConversationRaw): Conversation {
  return {
    id: r.id,
    title: r.title,
    project_id: r.project_id ?? null,
    archived: r.archived ?? r.archived_at !== null,
    created_at: r.created_at,
    updated_at: r.updated_at,
    topics: Array.isArray(r.topics) ? r.topics.filter((t): t is string => typeof t === 'string') : [],
  };
}

export async function listConversations(archived: boolean, projectId?: string): Promise<Conversation[]> {
  const params = new URLSearchParams({ limit: '50', offset: '0', archived: String(archived) });
  if (projectId) params.set('project_id', projectId);
  const body = await authJson<{ conversations: ConversationRaw[] }>(`/chat/conversations?${params.toString()}`);
  return body.conversations.map(normalizarConversacion);
}

export async function moveConversation(id: string, projectId: string | null): Promise<Conversation> {
  const body = await authJson<ConversationRaw>(`/chat/conversations/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ project_id: projectId }),
  });
  return normalizarConversacion(body);
}

// ——— B5: proyectos ———

export interface Project {
  id: string;
  name: string;
  instructions: string;
  conversation_count?: number;
  created_at: string;
  updated_at: string;
}

export async function listProjects(): Promise<Project[]> {
  const body = await authJson<{ projects: Project[] }>('/chat/projects');
  return body.projects;
}

export async function createProject(name: string, instructions?: string): Promise<Project> {
  return authJson<Project>('/chat/projects', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, instructions: instructions || undefined }),
  });
}

export async function updateProject(id: string, patch: { name?: string; instructions?: string }): Promise<Project> {
  return authJson<Project>(`/chat/projects/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });
}

export async function deleteProject(id: string): Promise<void> {
  await authJson<{ message: string }>(`/chat/projects/${id}`, { method: 'DELETE' });
}

// ——— B6: archivos por proyecto ———

export interface ProjectFile {
  id: string;
  project_id: string;
  filename: string;
  mime: string;
  size_bytes: number;
  chunk_count: number;
  status: string;
  error: string | null;
  /** B10: contenía marcadores de inyección (aviso, no bloqueo). */
  sospechoso?: boolean;
  created_at: string;
}

export interface FilesUsage {
  count: number;
  bytes: number;
  max_files: number;
  max_bytes: number;
}

export async function listProjectFiles(
  projectId: string,
): Promise<{ files: ProjectFile[]; usage: FilesUsage }> {
  return authJson<{ files: ProjectFile[]; usage: FilesUsage }>(
    `/chat/projects/${projectId}/files`,
  );
}

export async function uploadProjectFile(
  projectId: string,
  file: File,
): Promise<{ duplicado: boolean; file: ProjectFile; advertencia?: string }> {
  const form = new FormData();
  form.append('file', file, file.name);
  const r = await authFetch(`/chat/projects/${projectId}/files`, {
    method: 'POST',
    body: form,
  });
  if (!r.ok) {
    const t = await r.text().catch(() => '');
    let message = t.slice(0, 300) || r.statusText;
    try {
      const b = JSON.parse(t) as Record<string, unknown>;
      if (typeof b['message'] === 'string') message = b['message'];
    } catch {
      // texto plano
    }
    throw new AuthHttpError(r.status, message);
  }
  return (await r.json()) as { duplicado: boolean; file: ProjectFile; advertencia?: string };
}

// ——— Storage: todo lo subido ———

export interface StoredFile extends ProjectFile {
  project_name: string;
}

export interface StorageUsage {
  count: number;
  bytes: number;
}

export async function listAllFiles(): Promise<{ files: StoredFile[]; usage: StorageUsage }> {
  return authJson<{ files: StoredFile[]; usage: StorageUsage }>('/chat/files');
}

export async function downloadFile(fileId: string): Promise<Blob> {
  const r = await authFetch(`/chat/files/${fileId}/download`);
  if (!r.ok) throw new AuthHttpError(r.status, mensajeError(r.status, r.statusText));
  return r.blob();
}

export async function deleteProjectFile(projectId: string, fileId: string): Promise<string> {
  const b = await authJson<{ message: string }>(
    `/chat/projects/${projectId}/files/${fileId}`,
    { method: 'DELETE' },
  );
  return b.message;
}

// ——— B6: visor unificado de citas del chat (corpus + proyecto) ———

export interface CitaCorpus {
  fuente: 'corpus';
  chunk_id: string;
  ruta: string;
  texto: string;
  texto_contexto: string;
  doc: {
    titulo: string;
    numero: string;
    tipo: string;
    url_original: string;
    vigencia: string;
    autoridad: string;
    fecha_consulta: string | null;
  };
}

export interface CitaProyecto {
  fuente: 'proyecto';
  chunk_id: string;
  ruta: string;
  texto: string;
  texto_contexto: string;
  filename: string;
}

export type CitaChat = CitaCorpus | CitaProyecto;

function esCitaChat(b: Record<string, unknown>): boolean {
  if (typeof b['chunk_id'] !== 'string' || typeof b['ruta'] !== 'string') return false;
  if (typeof b['texto'] !== 'string' || typeof b['texto_contexto'] !== 'string') return false;
  if (b['fuente'] === 'proyecto') return typeof b['filename'] === 'string';
  const doc = b['doc'] as Record<string, unknown> | undefined;
  return (
    typeof doc === 'object' &&
    doc !== null &&
    typeof doc['titulo'] === 'string' &&
    typeof doc['url_original'] === 'string'
  );
}

export async function getCitaChat(chunkId: string): Promise<CitaChat> {
  const b = await authJson<CitaChat>(`/chat/citas/${chunkId}`);
  if (!esCitaChat(b as unknown as Record<string, unknown>)) {
    throw new Error('Respuesta de cita incompleta.');
  }
  return b;
}

// ——— B9: búsqueda, exportar, compartir, regenerar ———

export interface SearchHit {
  message_id: string;
  conversation_id: string;
  title: string;
  role: string;
  snippet: string;
  created_at: string;
}

export async function searchChat(q: string, limit = 20): Promise<{ q: string; count: number; hits: SearchHit[] }> {
  const params = new URLSearchParams({ q, limit: String(limit) });
  return authJson<{ q: string; count: number; hits: SearchHit[] }>(`/chat/search?${params.toString()}`);
}

export async function exportConversation(id: string): Promise<{ filename: string; markdown: string }> {
  return authJson<{ filename: string; markdown: string }>(`/chat/conversations/${id}/export`);
}

export async function shareConversation(id: string): Promise<{ token: string; path: string }> {
  return authJson<{ token: string; path: string }>(`/chat/conversations/${id}/share`, { method: 'POST' });
}

export async function unshareConversation(id: string): Promise<{ revoked: number }> {
  return authJson<{ revoked: number }>(`/chat/conversations/${id}/share`, { method: 'DELETE' });
}

export interface RegenerateResult {
  conversation_id: string;
  content: string;
  citations: Citation[];
  costo_usd: number;
  model: string;
}

export async function regenerateConversation(conversationId: string): Promise<RegenerateResult> {
  const body = await authJson<{
    conversation_id: string;
    message: { content: string; citations: Citation[] | null; model: string };
    costo_usd: number;
  }>('/chat/regenerate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ conversation_id: conversationId }),
  });
  return {
    conversation_id: body.conversation_id,
    content: body.message.content,
    citations: body.message.citations ?? [],
    costo_usd: body.costo_usd,
    model: body.message.model,
  };
}

// ——— B9: vista pública (sin login; el token opaco es la credencial) ———

export interface SharedCitation {
  n: number;
  ruta: string;
  titulo: string;
}

export interface SharedMessage {
  role: 'user' | 'assistant';
  content: string;
  citations: SharedCitation[];
}

export interface SharedConversation {
  title: string;
  created_at: string;
}

export async function getSharedConversation(
  token: string,
): Promise<{ conversation: SharedConversation; messages: SharedMessage[] }> {
  const r = await fetch(`${API}/chat/shared/${encodeURIComponent(token.slice(0, 200))}`);
  if (r.status === 404) throw new Error('enlace no válido o revocado');
  if (!r.ok) {
    const t = await r.text().catch(() => '');
    throw new Error(t.slice(0, 300) || `La API respondió ${r.status}.`);
  }
  const body = (await r.json()) as {
    conversation: SharedConversation;
    messages: Array<{ role: string; content: string; citations: SharedCitation[] | null }>;
  };
  return {
    conversation: body.conversation,
    messages: body.messages.map((m) => ({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: m.content,
      citations: m.citations ?? [],
    })),
  };
}

export async function getConversation(id: string): Promise<{ messages: ChatMessage[] }> {
  const body = await authJson<{
    conversation: Conversation;
    messages: Array<{
      id: string;
      role: string;
      content: string;
      citations: Citation[] | null;
      model: string | null;
      created_at: string;
    }>;
  }>(`/chat/conversations/${id}`);
  return {
    messages: body.messages.map((m) => ({
      id: m.id,
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: m.content,
      citations: m.citations ?? [],
      model: m.model,
      created_at: m.created_at,
    })),
  };
}

export async function renameConversation(id: string, title: string): Promise<void> {
  await authJson(`/chat/conversations/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title }),
  });
}

export async function archiveConversation(id: string, archived: boolean): Promise<void> {
  await authJson(`/chat/conversations/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ archived }),
  });
}

export async function deleteConversation(id: string): Promise<void> {
  await authJson(`/chat/conversations/${id}`, { method: 'DELETE' });
}

/** B11: preguntas de seguimiento (1 llamada barata; best-effort). */
export async function getSugerencias(conversationId: string): Promise<string[]> {
  const b = await authJson<{ sugerencias: string[] }>(`/chat/conversations/${conversationId}/sugerencias`);
  return Array.isArray(b.sugerencias)
    ? b.sugerencias.filter((s): s is string => typeof s === 'string' && s.trim().length > 0).slice(0, 3)
    : [];
}

export interface ModeloChat {
  id: string;
  defecto: boolean;
}

/** B7: modelos del plan del usuario (defecto primero según el servidor). */
export async function listChatModels(): Promise<{ defecto: string; modelos: ModeloChat[] }> {
  const body = await authJson<{ defecto: string; modelos: ModeloChat[] }>('/chat/modelos');
  return { defecto: body.defecto, modelos: body.modelos };
}

export interface StreamCallbacks {
  onMeta: (conversationId: string, isNew: boolean) => void;
  onTool: (name: string) => void;
  onToken: (delta: string) => void;
  onCitations: (citations: Citation[]) => void;
  onDone: (info: { messageId: string; costo_usd: number; model: string }) => void;
  onError: (status: number, message: string) => void;
}

interface SseEvent {
  name: string;
  data: string;
}

function parseSseBuffer(buffer: string): { events: SseEvent[]; rest: string } {
  const events: SseEvent[] = [];
  const parts = buffer.split('\n\n');
  const rest = parts.pop() ?? '';
  for (const part of parts) {
    const lines = part.split('\n');
    let name = '';
    const dataLines: string[] = [];
    for (const line of lines) {
      if (line.startsWith('event:')) name = line.slice(6).trim();
      else if (line.startsWith('data:')) dataLines.push(line.slice(5).trimStart());
    }
    if (name) events.push({ name, data: dataLines.join('\n') });
  }
  return { events, rest };
}

function safeJson(raw: string): Record<string, unknown> {
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return {};
  }
}

/** Streaming SSE real vía fetch + ReadableStream. Sin librerías. `model` y `projectId` opcionales. */
export async function streamChat(
  conversationId: string | null,
  content: string,
  cb: StreamCallbacks,
  signal: AbortSignal,
  model?: string,
  projectId?: string | null,
): Promise<void> {
  async function once(token: string | null): Promise<Response> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const cuerpo: Record<string, unknown> = conversationId
      ? { conversation_id: conversationId, content }
      : { content };
    if (model) cuerpo['model'] = model;
    // B6: crear el chat ya dentro del proyecto para que el primer mensaje
    // vea instrucciones y archivos (sin moverlo después).
    if (!conversationId && projectId) cuerpo['project_id'] = projectId;
    return fetch(`${API}/chat/stream`, {
      method: 'POST',
      headers,
      body: JSON.stringify(cuerpo),
      signal,
    });
  }

  let r = await once(getAccess());
  if (r.status === 401) {
    // refresh silencioso una vez y reintento (mismo flujo que authFetch)
    const refresh = getRefresh();
    if (refresh) {
      try {
        const rr = await fetch(`${API}/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refresh_token: refresh }),
          signal,
        });
        if (rr.ok) {
          const body = (await rr.json()) as Record<string, unknown>;
          const a = body['access_token'];
          const nf = body['refresh_token'];
          if (typeof a === 'string' && typeof nf === 'string') {
            localStorage.setItem('lex_access_token', a);
            localStorage.setItem('lex_refresh_token', nf);
            r = await once(a);
          }
        } else {
          cb.onError(401, 'Sesión expirada. Inicia sesión de nuevo.');
          return;
        }
      } catch {
        cb.onError(401, 'Sesión expirada. Inicia sesión de nuevo.');
        return;
      }
    } else {
      cb.onError(401, 'Sesión expirada. Inicia sesión de nuevo.');
      return;
    }
  }

  if (!r.ok) {
    const t = await r.text().catch(() => '');
    let message = t.slice(0, 300) || r.statusText;
    try {
      const b = JSON.parse(t) as Record<string, unknown>;
      if (typeof b['message'] === 'string') message = b['message'];
    } catch {
      // texto plano
    }
    cb.onError(r.status, message);
    return;
  }

  if (!r.body) {
    cb.onError(500, 'Respuesta sin cuerpo del servidor.');
    return;
  }

  const reader = r.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const { events, rest } = parseSseBuffer(buffer);
      buffer = rest;
      for (const ev of events) {
        const d = safeJson(ev.data);
        if (ev.name === 'meta') {
          const cid = d['conversation_id'];
          const isNew = d['is_new'];
          if (typeof cid === 'string') cb.onMeta(cid, isNew === true);
        } else if (ev.name === 'tool') {
          if (typeof d['name'] === 'string') cb.onTool(d['name'] as string);
        } else if (ev.name === 'token') {
          if (typeof d['delta'] === 'string') cb.onToken(d['delta'] as string);
        } else if (ev.name === 'citas') {
          const cits = Array.isArray(d['citations']) ? (d['citations'] as Citation[]) : [];
          cb.onCitations(cits);
        } else if (ev.name === 'done') {
          cb.onDone({
            messageId: typeof d['message_id'] === 'string' ? (d['message_id'] as string) : '',
            costo_usd: typeof d['costo_usd'] === 'number' ? (d['costo_usd'] as number) : 0,
            model: typeof d['model'] === 'string' ? (d['model'] as string) : '',
          });
        } else if (ev.name === 'error') {
          const status = typeof d['statusCode'] === 'number' ? (d['statusCode'] as number) : 500;
          const message =
            typeof d['message'] === 'string' ? (d['message'] as string) : 'Error del servidor.';
          cb.onError(status, message);
          return;
        }
      }
    }
  } catch (e) {
    if ((e as Error).name === 'AbortError') return;
    if (signal.aborted) return;
    cb.onError(0, 'Se perdió la conexión de red durante el streaming.');
  } finally {
    reader.releaseLock();
  }
}

/** Reintento no-stream ante error (POST /chat/send). `model` es opcional. */
export async function sendOnce(
  conversationId: string | null,
  content: string,
  model?: string,
): Promise<{ conversation_id: string; content: string; citations: Citation[]; costo_usd: number; model: string }> {
  const cuerpo: Record<string, unknown> = conversationId
    ? { conversation_id: conversationId, content }
    : { content };
  if (model) cuerpo['model'] = model;
  const body = await authJson<{
    conversation_id: string;
    message: { content: string; citations: Citation[]; model: string };
    costo_usd: number;
  }>(
    '/chat/send',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cuerpo),
    },
  );
  return {
    conversation_id: body.conversation_id,
    content: body.message.content,
    citations: body.message.citations ?? [],
    costo_usd: body.costo_usd,
    model: body.message.model,
  };
}

export { AuthHttpError, authFetch };
