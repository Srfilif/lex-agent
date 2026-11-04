import type { Conversation, Project } from '../chatApi';

// Cabecera del hilo: título, proyecto, mover, compartir, exportar.
export default function ThreadHead({
  activa,
  proyectoActivo,
  projects,
  shareUrl,
  shareMsg,
  shareBusy,
  onMover,
  onCompartir,
  onExportar,
  onCopiarShare,
  onRevocar,
}: {
  activa: Conversation;
  proyectoActivo: Project | null;
  projects: Project[];
  shareUrl: string;
  shareMsg: string;
  shareBusy: boolean;
  onMover: (projectId: string | null) => void;
  onCompartir: () => void;
  onExportar: () => void;
  onCopiarShare: (url: string) => void;
  onRevocar: () => void;
}): React.ReactElement {
  return (
    <>
      <div className="hilo-head">
        <div>
          <strong>{activa.title || 'Sin título'}</strong>
          <p className="meta">
            {proyectoActivo ? `Proyecto: ${proyectoActivo.name}` : 'Sin proyecto'}
            {(activa.topics?.length ?? 0) > 0 ? ` · Temas: ${(activa.topics ?? []).join(' · ')}` : ''}
          </p>
        </div>
        <div className="hilo-acciones">
          <label className="meta">
            Mover a:{' '}
            <select
              value={activa.project_id ?? ''}
              onChange={(e) => onMover(e.target.value || null)}
              aria-label="Mover chat a proyecto"
            >
              <option value="">Sin proyecto</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <button type="button" className="mini" onClick={onCompartir} disabled={shareBusy}>
            {shareBusy ? '…' : 'Compartir'}
          </button>
          <button type="button" className="mini" onClick={onExportar}>
            Exportar .md
          </button>
        </div>
      </div>
      {(shareUrl || shareMsg) && (
        <div className="share-caja">
          {shareUrl && (
            <p>
              Enlace público:{' '}
              <input readOnly value={shareUrl} onFocus={(e) => e.target.select()} aria-label="Enlace público" />
              <button type="button" className="mini" onClick={() => onCopiarShare(shareUrl)}>
                Copiar
              </button>
              <button type="button" className="mini danger" onClick={onRevocar} disabled={shareBusy}>
                Revocar
              </button>
            </p>
          )}
          {shareMsg && <p className="meta">{shareMsg}</p>}
        </div>
      )}
    </>
  );
}
