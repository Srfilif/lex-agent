import { useState } from 'react';
import {
  Archive,
  ArchiveRestore,
  Check,
  Folder,
  FolderPlus,
  Menu,
  MessageSquare,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { mensajeError, AuthHttpError } from '../auth';
import { searchChat, type Conversation, type Project, type SearchHit } from '../chatApi';
import { Alert, AlertDescription } from './ui/alert';
import { Button } from './ui/button';
import { Checkbox } from './ui/checkbox';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';

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
      <Button
        type="button"
        variant="outline"
        size="icon"
        className={`side-fab size-9 max-[860px]:h-9 max-[860px]:w-auto max-[860px]:gap-1.5 max-[860px]:px-3 ${open ? 'hidden' : 'inline-flex'}`}
        onClick={onToggleOpen}
        aria-label="Abrir panel de conversaciones"
        aria-expanded={open}
        title="Conversaciones"
      >
        <Menu />
        <span className="hidden max-[860px]:inline">Conversaciones</span>
      </Button>
      {open && <div className="side-overlay" onClick={onToggleOpen} aria-hidden="true" />}
      <aside className={`sidebar${open ? ' abierta' : ''}`} aria-label="Chats y proyectos">
        <div className="side-head">
          <strong>Conversaciones</strong>
          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 gap-1 px-2 text-xs"
              onClick={onNew}
              title="Nueva conversación"
              aria-label="Nueva conversación"
            >
              <Plus /> Nueva
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              onClick={onToggleOpen}
              aria-label="Ocultar panel de conversaciones"
              title="Ocultar panel"
            >
              <X />
            </Button>
          </div>
        </div>

        <form className="side-search" onSubmit={(e) => void buscar(e)}>
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar en conversaciones…"
            aria-label="Buscar en conversaciones"
            className="h-9"
          />
          <Button
            type="submit"
            variant="ghost"
            size="icon-sm"
            disabled={q.trim().length < 2 || searching}
            aria-label="Buscar"
            title="Buscar en el historial"
          >
            <Search />
          </Button>
        </form>

        {searchError && (
          <Alert variant="destructive" className="mx-1 my-2 border-destructive/30 bg-destructive/5 py-1.5">
            <AlertDescription className="text-xs">{searchError}</AlertDescription>
          </Alert>
        )}
        {(buscado || hits.length > 0) && (
          <div className="side-results">
            <p className="meta">
              {hits.length === 0
                ? 'Sin resultados.'
                : `${hits.length} resultado(s). Clic para abrir.`}
            </p>
            <ul>
              {hits.map((h) => (
                <li key={h.message_id}>
                  <button
                    type="button"
                    className="side-item"
                    onClick={() => onSelect(h.conversation_id)}
                    title={h.title}
                  >
                    <strong>{h.title || 'Sin título'}</strong>
                    <span className="meta">{h.snippet}</span>
                  </button>
                </li>
              ))}
            </ul>
            {buscado && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => {
                  setBuscado(false);
                  setHits([]);
                  setQ('');
                }}
              >
                Limpiar búsqueda
              </Button>
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

        {loading && (
          <div style={{ padding: '0 var(--space-1)' }}>
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className="skeleton"
                style={{ height: 22, margin: '0.35rem 0', width: `${92 - i * 8}%` }}
              />
            ))}
          </div>
        )}
        {!loading && conversations.length === 0 && (
          <div className="side-vacio">
            <p>Aún no tienes conversaciones aquí.</p>
            <p className="meta">Crea una nueva y haz tu primera pregunta jurídica.</p>
            <Button type="button" variant="outline" size="sm" className="mt-2" onClick={onNew}>
              <Plus /> Nueva consulta
            </Button>
          </div>
        )}

        <ul className="side-list">
          {conversations.map((c) => (
            <li key={c.id} className={c.id === activeId ? 'activa' : ''}>
              {editing === c.id ? (
                <Input
                  autoFocus
                  value={draft}
                  maxLength={120}
                  onChange={(e) => setDraft(e.target.value)}
                  onBlur={() => commitEdit(c.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitEdit(c.id);
                    if (e.key === 'Escape') setEditing(null);
                  }}
                  className="h-8 w-full"
                  aria-label="Renombrar conversación"
                />
              ) : (
                <button
                  type="button"
                  className="side-item"
                  onClick={() => onSelect(c.id)}
                  title={c.title}
                >
                  {c.title || 'Sin título'}
                </button>
              )}
              <div className="side-actions">
                {editing !== c.id && (
                  <button
                    type="button"
                    className="mini"
                    title="Renombrar"
                    aria-label="Renombrar conversación"
                    onClick={() => startEdit(c)}
                  >
                    <Pencil size={12} />
                  </button>
                )}
                <button
                  type="button"
                  className="mini"
                  title={c.archived ? 'Desarchivar' : 'Archivar'}
                  aria-label={c.archived ? 'Desarchivar conversación' : 'Archivar conversación'}
                  onClick={() => onArchive(c.id, !c.archived)}
                >
                  {c.archived ? <ArchiveRestore size={12} /> : <Archive size={12} />}
                </button>
                {confirmDelete === c.id ? (
                  <>
                    <button
                      type="button"
                      className="mini danger"
                      title="Confirmar borrado"
                      onClick={() => {
                        setConfirmDelete(null);
                        onDelete(c.id);
                      }}
                    >
                      <Check size={12} />
                    </button>
                    <button
                      type="button"
                      className="mini"
                      title="Cancelar"
                      onClick={() => setConfirmDelete(null)}
                    >
                      <X size={12} />
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    className="mini danger"
                    title="Borrar"
                    aria-label="Borrar conversación"
                    onClick={() => setConfirmDelete(c.id)}
                  >
                    <Trash2 size={12} />
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>

        <label className="side-arch">
          <Checkbox checked={showArchived} onCheckedChange={onToggleArchived} />
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
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 gap-1 px-2 text-xs"
          onClick={() => setCreando((v) => !v)}
          title="Crear proyecto"
          aria-label="Crear proyecto"
        >
          <FolderPlus /> {creando ? 'Cerrar' : 'Nuevo'}
        </Button>
      </div>
      {creando && (
        <form className="proj-form" onSubmit={(e) => void crear(e)}>
          <Input
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Nombre (1–120)"
            maxLength={120}
            aria-label="Nombre del proyecto"
            className="h-9"
          />
          <Textarea
            value={instr}
            onChange={(e) => setInstr(e.target.value)}
            placeholder="Instrucciones (opcional, máx. 4000)"
            maxLength={4000}
            rows={3}
            aria-label="Instrucciones del proyecto"
            className="min-h-20"
          />
          <Button type="submit" size="sm" disabled={!nombre.trim() || ocupado}>
            {ocupado ? 'Creando…' : 'Crear proyecto'}
          </Button>
        </form>
      )}
      {error && (
        <Alert variant="destructive" className="mx-1 my-2 border-destructive/30 bg-destructive/5 py-1.5">
          <AlertDescription className="text-xs">{error}</AlertDescription>
        </Alert>
      )}
      <ul className="side-list">
        <li className={filtro.kind === 'todos' ? 'activa' : ''}>
          <button type="button" className="side-item" onClick={() => onFiltro({ kind: 'todos' })}>
            <MessageSquare size={12} style={{ verticalAlign: '-1px', marginRight: 5 }} />
            Todos los chats
          </button>
        </li>
        {projects.map((p) => (
          <li key={p.id} className={activo(p.id) ? 'activa' : ''}>
            {editando === p.id ? (
              <Input
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
                className="h-8 w-full"
              />
            ) : (
              <button
                type="button"
                className="side-item"
                onClick={() => onFiltro({ kind: 'proyecto', id: p.id })}
                title={p.instructions || p.name}
              >
                <Folder size={12} style={{ verticalAlign: '-1px', marginRight: 5 }} />
                {p.name} <span className="meta">({p.conversation_count ?? 0})</span>
              </button>
            )}
            <div className="side-actions">
              {editando !== p.id && (
                <button
                  type="button"
                  className="mini"
                  title="Renombrar proyecto"
                  onClick={() => {
                    setEditando(p.id);
                    setDraftNombre(p.name);
                    setConfirm(null);
                  }}
                >
                  <Pencil size={12} />
                </button>
              )}
              <button
                type="button"
                className="mini"
                title="Ver o editar instrucciones"
                onClick={() => {
                  if (editInstrId === p.id) setEditInstrId(null);
                  else {
                    setEditInstrId(p.id);
                    setDraftInstr(p.instructions ?? '');
                  }
                }}
              >
                <MessageSquare size={12} />
              </button>
              {confirm === p.id ? (
                <>
                  <button
                    type="button"
                    className="mini danger"
                    title="Confirmar borrado del proyecto (los chats se conservan)"
                    onClick={() => {
                      setConfirm(null);
                      void onDelete(p.id);
                    }}
                  >
                    <Check size={12} />
                  </button>
                  <button type="button" className="mini" title="Cancelar" onClick={() => setConfirm(null)}>
                    <X size={12} />
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  className="mini danger"
                  title="Borrar proyecto (los chats se conservan)"
                  onClick={() => setConfirm(p.id)}
                >
                  <Trash2 size={12} />
                </button>
              )}
            </div>
            {editInstrId === p.id && (
              <div className="proj-instr">
                <Textarea
                  value={draftInstr}
                  onChange={(e) => setDraftInstr(e.target.value)}
                  maxLength={4000}
                  rows={3}
                  placeholder="Instrucciones del proyecto (máx. 4000)"
                  aria-label="Instrucciones del proyecto"
                  className="min-h-20"
                />
                <div className="side-actions">
                  <Button
                    type="button"
                    size="sm"
                    className="h-7 px-2 text-xs"
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
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs"
                    onClick={() => setEditInstrId(null)}
                  >
                    Cancelar
                  </Button>
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>
      {projects.length === 0 && (
        <p className="meta" style={{ fontSize: 'var(--text-xs)' }}>
          Sin proyectos. Crea uno para agrupar chats e instrucciones de un mismo caso.
        </p>
      )}
    </section>
  );
}
