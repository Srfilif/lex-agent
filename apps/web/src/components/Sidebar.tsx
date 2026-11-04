import { useState } from 'react';
import { mensajeError, AuthHttpError } from '../auth';
import { searchChat, type Conversation, type Project, type SearchHit } from '../chatApi';

export type FiltroProyecto = { kind: 'todos' } | { kind: 'sin' } | { kind: 'proyecto'; id: string };

export default function Sidebar({
  conversations,
  activeId,
  loading,
  showArchived,
  open,
  onToggleOpen,
  onSelect,
  onNew,
  onRename,
  onDelete,
  onArchive,
  onToggleArchived,
  projects,
  filtro,
  onFiltro,
  onCreateProject,
  onRenameProject,
  onEditInstructions,
  onDeleteProject,
  projectError,
}: {
  conversations: Conversation[];
  activeId: string | null;
  loading: boolean;
  showArchived: boolean;
  open: boolean;
  onToggleOpen: () => void;
  onSelect: (id: string) => void;
  onNew: () => void;
  onRename: (id: string, title: string) => void;
  onDelete: (id: string) => void;
  onArchive: (id: string, archived: boolean) => void;
  onToggleArchived: () => void;
  projects: Project[];
  filtro: FiltroProyecto;
  onFiltro: (f: FiltroProyecto) => void;
  onCreateProject: (name: string, instructions: string) => Promise<boolean>;
  onRenameProject: (id: string, name: string) => Promise<void>;
  onEditInstructions: (id: string, instructions: string) => Promise<void>;
  onDeleteProject: (id: string) => Promise<void>;
  projectError: string;
}): React.ReactElement {
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [buscado, setBuscado] = useState(false);

  function startEdit(c: Conversation): void {
    setEditing(c.id);
    setDraft(c.title);
    setConfirmDelete(null);
  }

  function commitEdit(id: string): void {
    const t = draft.trim().slice(0, 120);
    setEditing(null);
    if (t) onRename(id, t);
  }

  async function buscar(e?: React.FormEvent): Promise<void> {
    e?.preventDefault();
    const query = q.trim();
    if (query.length < 2 || searching) return;
    setSearching(true);
    setSearchError('');
    try {
      const r = await searchChat(query);
      setHits(r.hits);
      setBuscado(true);
    } catch (err) {
      if (err instanceof AuthHttpError) setSearchError(mensajeError(err.status, err.message));
      else setSearchError((err as Error).message);
    } finally {
      setSearching(false);
    }
  }

  return (
    <>
      <button type="button" className="side-fab" onClick={onToggleOpen} aria-label="Abrir o cerrar chats" aria-expanded={open}>
        ☰
      </button>
      {open && (
        <div
          className="side-overlay"
          onClick={onToggleOpen}
          aria-hidden="true"
        />
      )}
      <aside className={`sidebar${open ? ' abierta' : ''}`} aria-label="Chats y proyectos">
        <div className="side-top">
          <strong className="side-titulo">Chats</strong>
          <button type="button" className="mini" onClick={onToggleOpen} aria-label="Contraer panel de chats" title="Contraer">
            ⇤
          </button>
        </div>
        <form
          className="side-search"
          onSubmit={(e) => void buscar(e)}
        >
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar en chats… (mín. 2)"
            aria-label="Buscar en chats"
          />
          <button type="submit" disabled={q.trim().length < 2 || searching}>
            {searching ? '…' : '🔎'}
          </button>
        </form>
        {searchError && <p className="error">{searchError}</p>}
        {(buscado || hits.length > 0) && (
          <div className="side-results">
            <p className="meta">
              {hits.length === 0 ? 'Sin resultados.' : `${hits.length} resultado(s). Clic para abrir el chat.`}
            </p>
            <ul>
              {hits.map((h) => (
                <li key={h.message_id}>
                  <button type="button" className="side-item" onClick={() => onSelect(h.conversation_id)} title={h.title}>
                    <strong>{h.title || 'Sin título'}</strong>
                    <span className="meta">{h.snippet}</span>
                  </button>
                </li>
              ))}
            </ul>
            {buscado && (
              <button type="button" className="mini" onClick={() => { setBuscado(false); setHits([]); setQ(''); }}>
                Limpiar búsqueda
              </button>
            )}
          </div>
        )}
        <Proyectos
          projects={projects}
          filtro={filtro}
          onFiltro={onFiltro}
          onCreate={onCreateProject}
          onRename={onRenameProject}
          onEditInstructions={onEditInstructions}
          onDelete={onDeleteProject}
          error={projectError}
        />
        <div className="side-head">
          <strong>Chats</strong>
          <button type="button" onClick={onNew} title="Nueva conversación">
            + Nuevo
          </button>
        </div>
        {loading && <p className="meta">Cargando chats…</p>}
        {!loading && conversations.length === 0 && (
          <div className="side-vacio">
            <p>Aún no tienes conversaciones aquí.</p>
            <p className="meta">Empieza con «+ Nuevo» y haz tu primera pregunta jurídica.</p>
          </div>
        )}
        <ul className="side-list">
          {conversations.map((c) => (
            <li key={c.id} className={c.id === activeId ? 'activa' : ''}>
              {editing === c.id ? (
                <input
                  autoFocus
                  value={draft}
                  maxLength={120}
                  onChange={(e) => setDraft(e.target.value)}
                  onBlur={() => commitEdit(c.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitEdit(c.id);
                    if (e.key === 'Escape') setEditing(null);
                  }}
                />
              ) : (
                <button type="button" className="side-item" onClick={() => onSelect(c.id)} title={c.title}>
                  {c.title || 'Sin título'}
                </button>
              )}
              <div className="side-actions">
                {editing !== c.id && (
                  <button type="button" className="mini" title="Renombrar" onClick={() => startEdit(c)}>
                    ✎
                  </button>
                )}
                <button
                  type="button"
                  className="mini"
                  title={c.archived ? 'Desarchivar' : 'Archivar'}
                  onClick={() => onArchive(c.id, !c.archived)}
                >
                  {c.archived ? '↩' : '📦'}
                </button>
                {confirmDelete === c.id ? (
                  <>
                    <button type="button" className="mini danger" title="Confirmar borrado" onClick={() => { setConfirmDelete(null); onDelete(c.id); }}>
                      ¿Sí?
                    </button>
                    <button type="button" className="mini" title="Cancelar" onClick={() => setConfirmDelete(null)}>
                      No
                    </button>
                  </>
                ) : (
                  <button type="button" className="mini danger" title="Borrar" onClick={() => setConfirmDelete(c.id)}>
                    🗑
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
        <label className="side-arch">
          <input type="checkbox" checked={showArchived} onChange={onToggleArchived} />
          Ver archivados
        </label>
      </aside>
    </>
  );
}

function Proyectos({
  projects,
  filtro,
  onFiltro,
  onCreate,
  onRename,
  onEditInstructions,
  onDelete,
  error,
}: {
  projects: Project[];
  filtro: FiltroProyecto;
  onFiltro: (f: FiltroProyecto) => void;
  onCreate: (name: string, instructions: string) => Promise<boolean>;
  onRename: (id: string, name: string) => Promise<void>;
  onEditInstructions: (id: string, instructions: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  error: string;
}): React.ReactElement {
  const [nombre, setNombre] = useState('');
  const [instr, setInstr] = useState('');
  const [creando, setCreando] = useState(false);
  const [editando, setEditando] = useState<string | null>(null);
  const [draftNombre, setDraftNombre] = useState('');
  const [editInstrId, setEditInstrId] = useState<string | null>(null);
  const [draftInstr, setDraftInstr] = useState('');
  const [confirm, setConfirm] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  async function crear(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    const n = nombre.trim();
    if (!n || ocupado) return;
    setOcupado(true);
    try {
      const ok = await onCreate(n.slice(0, 120), instr.trim().slice(0, 4000));
      if (!ok) return; // el error ya se muestra; se conserva lo escrito
      setNombre('');
      setInstr('');
      setCreando(false);
    } finally {
      setOcupado(false);
    }
  }

  function activo(id: string): boolean {
    return filtro.kind === 'proyecto' && filtro.id === id;
  }

  return (
    <section className="side-proyectos">
      <div className="side-head">
        <strong>Proyectos</strong>
        <button type="button" onClick={() => setCreando((v) => !v)} title="Crear proyecto">
          {creando ? 'Cerrar' : '+ Nuevo'}
        </button>
      </div>
      {creando && (
        <form className="proj-form" onSubmit={(e) => void crear(e)}>
          <input
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Nombre (1–120)"
            maxLength={120}
            aria-label="Nombre del proyecto"
          />
          <textarea
            value={instr}
            onChange={(e) => setInstr(e.target.value)}
            placeholder="Instrucciones (opcional, máx. 4000)"
            maxLength={4000}
            rows={3}
            aria-label="Instrucciones del proyecto"
          />
          <button type="submit" disabled={!nombre.trim() || ocupado}>
            {ocupado ? 'Creando…' : 'Crear proyecto'}
          </button>
        </form>
      )}
      {error && <p className="error">{error}</p>}
      <ul className="side-list">
        <li className={filtro.kind === 'todos' ? 'activa' : ''}>
          <button type="button" className="side-item" onClick={() => onFiltro({ kind: 'todos' })}>
            Todos los chats
          </button>
        </li>
        <li className={filtro.kind === 'sin' ? 'activa' : ''}>
          <button type="button" className="side-item" onClick={() => onFiltro({ kind: 'sin' })}>
            Sin proyecto
          </button>
        </li>
        {projects.map((p) => (
          <li key={p.id} className={activo(p.id) ? 'activa' : ''}>
            {editando === p.id ? (
              <input
                autoFocus
                value={draftNombre}
                maxLength={120}
                onChange={(e) => setDraftNombre(e.target.value)}
                onBlur={() => {
                  const t = draftNombre.trim();
                  setEditando(null);
                  if (t && t !== p.name) void onRename(p.id, t.slice(0, 120));
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const t = draftNombre.trim();
                    setEditando(null);
                    if (t && t !== p.name) void onRename(p.id, t.slice(0, 120));
                  }
                  if (e.key === 'Escape') setEditando(null);
                }}
                aria-label="Renombrar proyecto"
              />
            ) : (
              <button
                type="button"
                className="side-item"
                onClick={() => onFiltro({ kind: 'proyecto', id: p.id })}
                title={p.instructions || p.name}
              >
                {p.name} <span className="meta">({p.conversation_count ?? 0})</span>
              </button>
            )}
            <div className="side-actions">
              {editando !== p.id && (
                <button
                  type="button"
                  className="mini"
                  title="Renombrar proyecto"
                  onClick={() => { setEditando(p.id); setDraftNombre(p.name); setConfirm(null); }}
                >
                  ✎
                </button>
              )}
              <button
                type="button"
                className="mini"
                title="Ver o editar instrucciones"
                onClick={() => {
                  if (editInstrId === p.id) setEditInstrId(null);
                  else { setEditInstrId(p.id); setDraftInstr(p.instructions ?? ''); }
                }}
              >
                📝
              </button>
              {confirm === p.id ? (
                <>
                  <button
                    type="button"
                    className="mini danger"
                    title="Confirmar borrado del proyecto (los chats se conservan)"
                    onClick={() => { setConfirm(null); void onDelete(p.id); }}
                  >
                    ¿Sí?
                  </button>
                  <button type="button" className="mini" title="Cancelar" onClick={() => setConfirm(null)}>
                    No
                  </button>
                </>
              ) : (
                <button type="button" className="mini danger" title="Borrar proyecto (los chats se conservan)" onClick={() => setConfirm(p.id)}>
                  🗑
                </button>
              )}
            </div>
            {editInstrId === p.id && (
              <div className="proj-instr">
                <textarea
                  value={draftInstr}
                  onChange={(e) => setDraftInstr(e.target.value)}
                  maxLength={4000}
                  rows={3}
                  placeholder="Instrucciones del proyecto (máx. 4000)"
                  aria-label="Instrucciones del proyecto"
                />
                <div className="side-actions">
                  <button
                    type="button"
                    className="mini"
                    disabled={ocupado}
                    onClick={() => {
                      setOcupado(true);
                      void onEditInstructions(p.id, draftInstr.trim().slice(0, 4000)).finally(() => {
                        setOcupado(false);
                        setEditInstrId(null);
                      });
                    }}
                  >
                    Guardar
                  </button>
                  <button type="button" className="mini" onClick={() => setEditInstrId(null)}>
                    Cerrar
                  </button>
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>
      {projects.length === 0 && (
        <p className="meta">Sin proyectos. Crea uno para agrupar tus chats.</p>
      )}
    </section>
  );
}
