import { useEffect, useRef, useState } from 'react';
import { AuthHttpError, mensajeError } from '../auth';
import { fetchPreferencias } from '../cuenta';
import {
  archiveConversation,
  createProject,
  deleteConversation,
  deleteProject,
  exportConversation,
  getConversation,
  getSugerencias,
  listChatModels,
  listConversations,
  listProjects,
  moveConversation,
  regenerateConversation,
  renameConversation,
  sendOnce,
  shareConversation,
  streamChat,
  unshareConversation,
  updateProject,
  type ChatMessage,
  type Citation,
  type Conversation,
  type Project,
} from '../chatApi';
import ArchivosProyecto from './ArchivosProyecto';
import Composer from './Composer';
import Fragmento from './Fragmento';
import MessageBubble from './MessageBubble';
import Sidebar, { type FiltroProyecto } from './Sidebar';
import ThreadHead from './ThreadHead';
import WelcomePane from './WelcomePane';

function uid(): string {
  return `local-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
}

export default function ChatShell({ modeloPreferido }: { modeloPreferido?: string | null }): React.ReactElement {
  // B7: catálogo del plan + selección de sesión. Efectivo = selección ??
  // preferencia ai.model (si sigue en el plan) ?? defecto del servidor.
  const [modelos, setModelos] = useState<Array<{ id: string; defecto: boolean }>>([]);
  const [modeloSel, setModeloSel] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    void (async () => {
      try {
        const cat = await listChatModels();
        if (!vivo) return;
        setModelos(cat.modelos);
        let pref = modeloPreferido ?? null;
        if (pref === null) {
          const p = await fetchPreferencias().catch(() => null);
          pref = p?.ai.model ?? null;
        }
        if (vivo && pref && cat.modelos.some((m) => m.id === pref)) setModeloSel(pref);
      } catch {
        // best-effort: sin catálogo el servidor usa su defecto
      }
    })();
    return () => {
      vivo = false;
    };
  }, [modeloPreferido]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [convLoading, setConvLoading] = useState(false);
  const [listLoading, setListLoading] = useState(true);
  const [showArchived, setShowArchived] = useState(false);
  const [sideOpen, setSideOpen] = useState(true);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [citaChunk, setCitaChunk] = useState<string | null>(null);
  const [citaSecop, setCitaSecop] = useState<string | null>(null);
  const [globalError, setGlobalError] = useState('');
  // B11: preguntas de seguimiento (1 llamada barata por respuesta completa).
  const [sugerencias, setSugerencias] = useState<string[]>([]);
  const sugVistas = useRef('');

  useEffect(() => {
    const last = messages[messages.length - 1];
    if (
      !activeId ||
      !last ||
      last.role !== 'assistant' ||
      last.pending ||
      last.error ||
      !last.content
    ) {
      if (messages.length === 0) setSugerencias([]);
      return;
    }
    // Solo al terminar (durante el stream, cada token re-dispararía el
    // efecto y el cleanup cancelaría el setState: 1 llamada perdida).
    if (sending) return;
    const key = `${activeId}:${last.id}`;
    if (sugVistas.current === key) return;
    sugVistas.current = key;
    let vivo = true;
    void getSugerencias(activeId)
      .then((ss) => {
        if (vivo) setSugerencias(ss);
      })
      .catch(() => undefined);
    return () => {
      vivo = false;
    };
  }, [activeId, messages, sending]);
  // B5: proyectos + filtro
  const [projects, setProjects] = useState<Project[]>([]);
  const [filtro, setFiltro] = useState<FiltroProyecto>({ kind: 'todos' });
  const [projectError, setProjectError] = useState('');
  // B9: compartir / exportar / regenerar
  const [shareUrl, setShareUrl] = useState('');
  const [shareBusy, setShareBusy] = useState(false);
  const [shareMsg, setShareMsg] = useState('');
  const [regenBusy, setRegenBusy] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const stopRef = useRef(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const activeRef = useRef<string | null>(null);
  activeRef.current = activeId;
  const filtroRef = useRef<FiltroProyecto>(filtro);
  filtroRef.current = filtro;
  const archivedRef = useRef(showArchived);
  archivedRef.current = showArchived;

  async function refreshProjects(): Promise<void> {
    try {
      setProjects(await listProjects());
    } catch (e) {
      setProjectError(describeListError(e));
    }
  }

  async function refreshList(archived: boolean, f: FiltroProyecto): Promise<void> {
    setListLoading(true);
    try {
      if (f.kind === 'proyecto') {
        const [abiertas, arch] = await Promise.all([
          listConversations(false, f.id),
          archived ? listConversations(true, f.id) : Promise.resolve([] as Conversation[]),
        ]);
        setConversations([...abiertas, ...arch]);
      } else {
        const [abiertas, arch] = await Promise.all([
          listConversations(false),
          archived ? listConversations(true) : Promise.resolve([] as Conversation[]),
        ]);
        const todas = [...abiertas, ...arch];
        setConversations(f.kind === 'sin' ? todas.filter((c) => !c.project_id) : todas);
      }
    } catch (e) {
      setGlobalError(describeListError(e));
    } finally {
      setListLoading(false);
    }
  }

  useEffect(() => {
    void refreshList(false, { kind: 'todos' });
    void refreshProjects();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function cambiarFiltro(f: FiltroProyecto): void {
    setFiltro(f);
    void refreshList(archivedRef.current, f);
  }

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function select(id: string): Promise<void> {
    abortRef.current?.abort();
    setActiveId(id);
    setCitaChunk(null);
    setCitaSecop(null);
    setGlobalError('');
    setShareUrl('');
    setShareMsg('');
    setConvLoading(true);
    try {
      const { messages: ms } = await getConversation(id);
      if (activeRef.current === id) setMessages(ms);
    } catch (e) {
      setGlobalError(describeListError(e));
    } finally {
      setConvLoading(false);
    }
  }

  /** Abrir un chat: si está fuera del filtro actual (p. ej. desde búsqueda),
   * se vuelve a «todos» para que siga visible; si no, se respeta el filtro. */
  async function selectAnywhere(id: string): Promise<void> {
    if (!conversations.some((c) => c.id === id)) {
      setFiltro({ kind: 'todos' });
      await refreshList(archivedRef.current, { kind: 'todos' });
    }
    await select(id);
  }

  function newChat(): void {
    abortRef.current?.abort();
    setActiveId(null);
    setMessages([]);
    setCitaChunk(null);
    setCitaSecop(null);
    setGlobalError('');
    setShareUrl('');
    setShareMsg('');
    setSideOpen(false);
  }

  async function rename(id: string, title: string): Promise<void> {
    setConversations((cs) => cs.map((c) => (c.id === id ? { ...c, title } : c)));
    try {
      await renameConversation(id, title);
    } catch (e) {
      setGlobalError(describeListError(e));
      void refreshList(archivedRef.current, filtroRef.current);
    }
  }

  async function remove(id: string): Promise<void> {
    try {
      await deleteConversation(id);
    } catch (e) {
      setGlobalError(describeListError(e));
      return;
    }
    setConversations((cs) => cs.filter((c) => c.id !== id));
    if (activeId === id) {
      setActiveId(null);
      setMessages([]);
      setShareUrl('');
    }
  }

  async function archive(id: string, archived: boolean): Promise<void> {
    try {
      await archiveConversation(id, archived);
    } catch (e) {
      setGlobalError(describeListError(e));
      return;
    }
    if (!archivedRef.current && archived) {
      setConversations((cs) => cs.filter((c) => c.id !== id));
      if (activeId === id) {
        setActiveId(null);
        setMessages([]);
      }
    } else {
      await refreshList(archivedRef.current, filtroRef.current);
    }
  }

  function toggleArchived(): void {
    const next = !showArchived;
    setShowArchived(next);
    void refreshList(next, filtroRef.current);
  }

  // ——— B5: CRUD de proyectos ———

  async function crearProyecto(name: string, instructions: string): Promise<boolean> {
    setProjectError('');
    try {
      await createProject(name, instructions);
      await refreshProjects();
      return true;
    } catch (e) {
      // El error ya queda visible en projectError; no se relanza.
      setProjectError(describeListError(e));
      return false;
    }
  }

  async function renombrarProyecto(id: string, name: string): Promise<void> {
    setProjectError('');
    try {
      const p = await updateProject(id, { name });
      setProjects((ps) => ps.map((x) => (x.id === id ? { ...x, name: p.name } : x)));
    } catch (e) {
      setProjectError(describeListError(e));
      void refreshProjects();
    }
  }

  async function editarInstrucciones(id: string, instructions: string): Promise<void> {
    setProjectError('');
    try {
      const p = await updateProject(id, { instructions });
      setProjects((ps) => ps.map((x) => (x.id === id ? { ...x, instructions: p.instructions } : x)));
    } catch (e) {
      setProjectError(describeListError(e));
      void refreshProjects();
    }
  }

  async function borrarProyecto(id: string): Promise<void> {
    setProjectError('');
    try {
      await deleteProject(id);
    } catch (e) {
      setProjectError(describeListError(e));
      return;
    }
    setProjects((ps) => ps.filter((x) => x.id !== id));
    // Los chats se conservan sin proyecto: refrescar lista y filtro.
    if (filtroRef.current.kind === 'proyecto' && filtroRef.current.id === id) {
      setFiltro({ kind: 'todos' });
      await refreshList(archivedRef.current, { kind: 'todos' });
    } else {
      await refreshList(archivedRef.current, filtroRef.current);
    }
    await refreshProjects();
  }

  async function moverActivo(projectId: string | null): Promise<void> {
    const id = activeRef.current;
    if (!id) return;
    setGlobalError('');
    try {
      const c = await moveConversation(id, projectId);
      setConversations((cs) => {
        const f = filtroRef.current;
        if (f.kind === 'proyecto' && c.project_id !== f.id) return cs.filter((x) => x.id !== id);
        if (f.kind === 'sin' && c.project_id) return cs.filter((x) => x.id !== id);
        return cs.map((x) => (x.id === id ? { ...x, project_id: c.project_id } : x));
      });
      void refreshProjects();
    } catch (e) {
      setGlobalError(describeListError(e));
    }
  }

  // ——— B9: compartir / exportar / regenerar ———

  async function compartir(): Promise<void> {
    const id = activeRef.current;
    if (!id || shareBusy) return;
    setShareBusy(true);
    setShareMsg('');
    try {
      const r = await shareConversation(id);
      // URL pública de la WEB (no de la API): la SPA la abre en SharedView.
      const url = `${window.location.origin}/?share=${r.token}`;
      setShareUrl(url);
      setShareMsg('Enlace creado. Cualquiera con el enlace puede leerlo; revócalo cuando quieras.');
    } catch (e) {
      setShareMsg(describeListError(e));
    } finally {
      setShareBusy(false);
    }
  }

  async function revocar(): Promise<void> {
    const id = activeRef.current;
    if (!id || shareBusy) return;
    setShareBusy(true);
    try {
      await unshareConversation(id);
      setShareUrl('');
      setShareMsg('Enlace revocado. El enlace anterior ya no funciona.');
    } catch (e) {
      setShareMsg(describeListError(e));
    } finally {
      setShareBusy(false);
    }
  }

  async function exportar(): Promise<void> {
    const id = activeRef.current;
    if (!id) return;
    setGlobalError('');
    try {
      const r = await exportConversation(id);
      const blob = new Blob([r.markdown], { type: 'text/markdown' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = r.filename;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (e) {
      setGlobalError(describeListError(e));
    }
  }

  async function regenerar(): Promise<void> {
    const id = activeRef.current;
    if (!id || regenBusy || messages.length === 0) return;
    const prev = messages[messages.length - 1];
    if (prev.role !== 'assistant' || prev.pending) return;
    setRegenBusy(true);
    setGlobalError('');
    setMessages((ms) =>
      ms.map((m) =>
        m.id === prev.id ? { ...m, content: '', citations: [], pending: true, error: null, tools: [] } : m,
      ),
    );
    try {
      const out = await regenerateConversation(id);
      setMessages((ms) =>
        ms.map((m) =>
          m.id === prev.id
            ? { ...m, pending: false, content: out.content, citations: out.citations, model: out.model, costo_usd: out.costo_usd }
            : m,
        ),
      );
    } catch (e) {
      const msg = e instanceof AuthHttpError ? mensajeError(e.status, e.message) : (e as Error).message;
      setMessages((ms) =>
        ms.map((m) =>
          m.id === prev.id
            ? { ...m, pending: false, content: prev.content, citations: prev.citations, error: msg }
            : m,
        ),
      );
    } finally {
      setRegenBusy(false);
    }
  }

  function openCita(c: Citation): void {
    if (c.chunk_id) {
      setCitaSecop(null);
      setCitaChunk(c.chunk_id);
    } else if (c.secop_ref) {
      setCitaChunk(null);
      setCitaSecop(`Contrato SECOP ${c.secop_ref} · ${c.titulo}`);
    }
  }

  function scheduleTitleRefresh(convId: string): void {
    // El backend genera el título async: releer tarde sin pisar la vista.
    for (const ms of [6000, 18000]) {
      window.setTimeout(() => {
        void (async () => {
          try {
            const all = await listConversations(false);
            setConversations((prev) => {
              const fresh = all.find((c) => c.id === convId);
              if (!fresh) return prev;
              if (prev.some((c) => c.id === convId)) {
                return prev.map((c) =>
                  c.id === convId ? { ...c, title: fresh.title, topics: fresh.topics } : c,
                );
              }
              return [fresh, ...prev];
            });
          } catch {
            // best-effort
          }
        })();
      }, ms);
    }
  }

  async function send(retryContent?: string): Promise<void> {
    const content = (retryContent ?? input).trim();
    if (!content || sending || content.length > 8000) return;
    if (!retryContent) setInput('');
    setGlobalError('');
    abortRef.current?.abort();
    stopRef.current = false;
    const abort = new AbortController();
    abortRef.current = abort;

    const userMsg: ChatMessage = {
      id: uid(),
      role: 'user',
      content,
      citations: [],
      model: null,
      created_at: new Date().toISOString(),
    };
    const draftId = uid();
    setMessages((ms) => [
      ...ms,
      userMsg,
      { id: draftId, role: 'assistant', content: '', citations: [], model: null, created_at: '', pending: true, tools: [] },
    ]);
    setSending(true);

    let acc = '';
    const tools: string[] = [];
    let convId: string | null = activeRef.current;
    let wasNew = false;

    const patch = (f: (m: ChatMessage) => ChatMessage): void =>
      setMessages((ms) => ms.map((m) => (m.id === draftId ? f(m) : m)));

    try {
      await streamChat(
        convId,
        content,
        {
          onMeta: (cid, isNew) => {
            convId = cid;
            wasNew = isNew;
            setActiveId(cid);
            // B5: si el chat nace dentro de un proyecto, asignarlo automáticamente.
            const f = filtroRef.current;
            if (isNew && f.kind === 'proyecto') {
              void moveConversation(cid, f.id)
                .then(() => refreshProjects())
                .catch(() => undefined);
            }
            void refreshList(archivedRef.current, filtroRef.current);
          },
          onTool: (name) => {
            tools.push(name);
            patch((m) => ({ ...m, tools: [...(m.tools ?? []), name] }));
          },
          onToken: (delta) => {
            acc += delta;
            const snapshot = acc;
            patch((m) => ({ ...m, content: snapshot, pending: false }));
          },
          onCitations: (citations) => {
            patch((m) => ({ ...m, citations }));
          },
          onDone: (info) => {
            patch((m) => ({
              ...m,
              pending: false,
              model: info.model || m.model,
              costo_usd: info.costo_usd,
              tools: m.tools,
            }));
            if (wasNew && convId) scheduleTitleRefresh(convId);
          },
          onError: (status, message) => {
            if (status === 401) {
              patch((m) => ({ ...m, pending: false, error: 'Sesión expirada. Inicia sesión de nuevo.' }));
            } else {
              patch((m) => ({ ...m, pending: false, error: mensajeError(status, message) }));
            }
          },
        },
        abort.signal,
        modeloSel ?? undefined,
        // B6: si el chat nace dentro de un filtro de proyecto, crearlo ahí.
        !convId && filtroRef.current.kind === 'proyecto' ? filtroRef.current.id : undefined,
      );
      // Si el stream terminó sin deltas ni error (p. ej. red cortada), marcarlo.
      patch((m) => {
        if (m.pending && !m.error && !m.content) {
          return { ...m, pending: false, error: 'La respuesta se interrumpió. Reintenta el envío.' };
        }
        return { ...m, pending: false };
      });
    } catch (e) {
      if (abort.signal.aborted) {
        // Detención manual: conservar lo parcial sin error; si no llegó nada, aviso.
        if (stopRef.current) {
          patch((m) =>
            m.content
              ? { ...m, pending: false }
              : { ...m, pending: false, error: 'Generación detenida. Reintenta el envío.' },
          );
        }
        return;
      }
      patch((m) => ({ ...m, pending: false, error: describeSendError(e) }));
    } finally {
      setSending(false);
    }
  }

  async function retryFailed(failedId: string): Promise<void> {
    const idx = messages.findIndex((m) => m.id === failedId);
    if (idx < 0 || !messages[idx].error) return;
    // Reenvía el último mensaje del usuario previo al fallo (el borrador
    // fallido es del asistente y está vacío). Nota: el backend ya persistió
    // ese mensaje de usuario, así que el reintento lo duplica en el historial
    // remoto; la UI solo actualiza el borrador (hasta B9 regenerar).
    let userContent = '';
    for (let i = idx - 1; i >= 0; i--) {
      if (messages[i].role === 'user') {
        userContent = messages[i].content;
        break;
      }
    }
    if (!userContent.trim()) return;
    setMessages((ms) => ms.map((m) => (m.id === failedId ? { ...m, error: null, pending: true } : m)));
    try {
      const out = await sendOnce(activeRef.current, userContent, modeloSel ?? undefined);
      setMessages((ms) =>
        ms.map((m) =>
          m.id === failedId
            ? {
                ...m,
                pending: false,
                error: null,
                citations: out.citations,
                costo_usd: out.costo_usd,
                model: out.model,
              }
            : m,
        ),
      );
      if (out.conversation_id !== activeRef.current) {
        setActiveId(out.conversation_id);
        void refreshList(archivedRef.current, filtroRef.current);
      }
    } catch (e) {
      setMessages((ms) =>
        ms.map((m) => (m.id === failedId ? { ...m, pending: false, error: describeSendError(e) } : m)),
      );
    }
  }

  function copy(text: string): void {
    void navigator.clipboard?.writeText(text).catch(() => undefined);
  }

  function detener(): void {
    stopRef.current = true;
    abortRef.current?.abort();
  }

  const activa = conversations.find((c) => c.id === activeId) ?? null;
  const proyectoActivo = activa?.project_id ? (projects.find((p) => p.id === activa.project_id) ?? null) : null;
  const ultima = messages.length > 0 ? messages[messages.length - 1] : null;
  const puedeRegenerar =
    activeId !== null && ultima !== null && ultima.role === 'assistant' && !ultima.pending && !ultima.error && !!ultima.content;

  return (
    <div className={`chat-shell${sideOpen ? '' : ' side-cerrado'}`}>
      <Sidebar
        conversations={conversations}
        activeId={activeId}
        loading={listLoading}
        showArchived={showArchived}
        open={sideOpen}
        onToggleOpen={() => setSideOpen((v) => !v)}
        onSelect={(id) => void selectAnywhere(id)}
        onNew={newChat}
        onRename={(id, t) => void rename(id, t)}
        onDelete={(id) => void remove(id)}
        onArchive={(id, a) => void archive(id, a)}
        onToggleArchived={toggleArchived}
        projects={projects}
        filtro={filtro}
        onFiltro={cambiarFiltro}
        onCreateProject={crearProyecto}
        onRenameProject={renombrarProyecto}
        onEditInstructions={editarInstrucciones}
        onDeleteProject={borrarProyecto}
        projectError={projectError}
      />
      <div className="chat-main">
        {filtro.kind === 'proyecto' &&
          (() => {
            const p = projects.find((x) => x.id === filtro.id);
            if (!p) return null;
            return (
              <ArchivosProyecto
                projectId={p.id}
                projectName={p.name}
                onCambio={() => void refreshProjects()}
              />
            );
          })()}
        {activa && (
          <ThreadHead
            activa={activa}
            proyectoActivo={proyectoActivo}
            projects={projects}
            shareUrl={shareUrl}
            shareMsg={shareMsg}
            shareBusy={shareBusy}
            onMover={(pid) => void moverActivo(pid)}
            onCompartir={() => void compartir()}
            onExportar={() => void exportar()}
            onCopiarShare={(url) => copy(url)}
            onRevocar={() => void revocar()}
          />
        )}
        {globalError && <p className="error" role="alert">{globalError}</p>}
        {convLoading && <p className="meta">Cargando conversación…</p>}
        {!convLoading && messages.length === 0 && <WelcomePane onEjemplo={(q) => void send(q)} />}
        <ol className="hilo">
          {messages.map((m, i) => (
            <MessageBubble
              key={m.id}
              m={m}
              isLast={i === messages.length - 1}
              puedeRegenerar={puedeRegenerar}
              regenBusy={regenBusy}
              onCita={openCita}
              onCopy={(t) => copy(t)}
              onRetry={(id) => void retryFailed(id)}
              onRegenerar={() => void regenerar()}
            />
          ))}
        </ol>
        <div ref={bottomRef} />
        {sugerencias.length > 0 && !sending && (
          <div className="ejemplos" aria-label="Preguntas sugeridas">
            {sugerencias.map((s) => (
              <button key={s} type="button" className="ejemplo" onClick={() => void send(s)}>
                {s}
              </button>
            ))}
          </div>
        )}
        <Composer
          input={input}
          sending={sending}
          onInput={setInput}
          onSend={() => void send()}
          onStop={detener}
        />
        {modelos.length > 1 ? (
          <p className="meta">
            <label>
              Modelo:{' '}
              <select
                aria-label="Modelo de chat"
                value={modeloSel ?? ''}
                onChange={(e) => setModeloSel(e.target.value || null)}
              >
                <option value="">Por defecto del plan</option>
                {modelos.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.id}
                    {m.defecto ? ' (defecto)' : ''}
                  </option>
                ))}
              </select>
            </label>
          </p>
        ) : (
          <p className="meta">
            Modelo efectivo: {modelos[0]?.id ?? 'por defecto del servidor (según tu plan)'}
          </p>
        )}
      </div>
      <div className="chat-side">
        {citaSecop && (
          <aside className="fragmento">
            <h2>Contrato citado</h2>
            <p>{citaSecop}</p>
            <p className="meta">Detalle completo disponible en la vista Contratos SECOP.</p>
          </aside>
        )}
        {!citaSecop && <Fragmento chunkId={citaChunk} modo="chat" />}
      </div>
    </div>
  );
}

function describeListError(e: unknown): string {
  if (e instanceof AuthHttpError) return mensajeError(e.status, e.message);
  if (e instanceof TypeError) return 'Sin conexión con la API (¿corre en :3000?).';
  return (e as Error).message;
}

function describeSendError(e: unknown): string {
  if (e instanceof AuthHttpError) return mensajeError(e.status, e.message);
  if (e instanceof TypeError) return 'Fallo de red: no se pudo contactar la API.';
  if (e instanceof DOMException && e.name === 'AbortError') return 'Envío cancelado.';
  return (e as Error).message;
}
