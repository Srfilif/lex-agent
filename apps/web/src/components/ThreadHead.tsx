import { Download, FolderInput, Link2, Share2 } from 'lucide-react';
import type { Conversation, Project } from '../chatApi';
import { Button } from './ui/button';
import { Input } from './ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';

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
      <div className="thread-head">
        <div className="thread-title">
          <strong>{activa.title || 'Sin título'}</strong>
          <span className="meta">
            {proyectoActivo ? `Proyecto: ${proyectoActivo.name}` : 'Sin proyecto'}
            {(activa.topics?.length ?? 0) > 0 ? ` · ${(activa.topics ?? []).join(' · ')}` : ''}
          </span>
        </div>
        <div className="thread-actions">
          <label className="meta flex items-center gap-1">
            <FolderInput size={13} />
            <Select
              value={activa.project_id ?? 'none'}
              onValueChange={(value) => onMover(value === 'none' ? null : value)}
            >
              <SelectTrigger size="sm" className="h-8 min-w-[150px]" aria-label="Mover chat a proyecto">
                <SelectValue placeholder="Sin proyecto" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sin proyecto</SelectItem>
                {projects.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onCompartir}
            disabled={shareBusy}
            title="Crear enlace público de solo lectura"
          >
            <Share2 />
            {shareBusy ? '…' : 'Compartir'}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onExportar}
            title="Exportar la conversación en Markdown"
          >
            <Download />
            Exportar
          </Button>
        </div>
      </div>
      {(shareUrl || shareMsg) && (
        <div className="chat-inner" style={{ paddingTop: 'var(--space-3)' }}>
          <div className="share-caja">
            {shareUrl && (
              <p>
                <Link2 size={13} />
                <span>Enlace público:</span>
                <Input
                  readOnly
                  value={shareUrl}
                  onFocus={(e) => e.target.select()}
                  aria-label="Enlace público"
                  className="h-8"
                />
                <Button type="button" variant="outline" size="sm" className="h-8" onClick={() => onCopiarShare(shareUrl)}>
                  Copiar
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  className="h-8"
                  onClick={onRevocar}
                  disabled={shareBusy}
                >
                  Revocar
                </Button>
              </p>
            )}
            {shareMsg && <p className="meta">{shareMsg}</p>}
          </div>
        </div>
      )}
    </>
  );
}
