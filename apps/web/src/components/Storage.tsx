import { useEffect, useMemo, useState } from 'react';
import {
  Download,
  FileText,
  FolderOpen,
  RefreshCw,
  Search,
  ShieldCheck,
  Trash2,
  Upload,
} from 'lucide-react';
import { AuthHttpError, mensajeError } from '../auth';
import {
  deleteProjectFile,
  downloadFile,
  listAllFiles,
  type StorageUsage,
  type StoredFile,
} from '../chatApi';
import { fechaLegible, tamanoLegible } from '../shared/formato';
import { Alert, AlertDescription } from './ui/alert';
import { Button } from './ui/button';
import { Input } from './ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';

// Documentos: todo lo subido por el usuario en todos los proyectos,
// con descarga y borrado. Rutas: /storage y /settings/storage (alias).

export default function Storage(): React.ReactElement {
  const [files, setFiles] = useState<StoredFile[]>([]);
  const [usage, setUsage] = useState<StorageUsage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [proyecto, setProyecto] = useState('');
  const [confirmBorrar, setConfirmBorrar] = useState<string | null>(null);
  const [borrando, setBorrando] = useState(false);
  const [descargando, setDescargando] = useState<string | null>(null);

  async function refrescar(): Promise<void> {
    setLoading(true);
    setError('');
    try {
      const r = await listAllFiles();
      setFiles(r.files);
      setUsage(r.usage);
    } catch (e) {
      setError(
        e instanceof AuthHttpError ? mensajeError(e.status, e.message) : (e as Error).message,
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refrescar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const proyectos = useMemo(
    () => [...new Map(files.map((f) => [f.project_id, f.project_name])).entries()],
    [files],
  );
  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return files.filter(
      (f) =>
        (!proyecto || f.project_id === proyecto) &&
        (!q || f.filename.toLowerCase().includes(q) || f.project_name.toLowerCase().includes(q)),
    );
  }, [files, busqueda, proyecto]);

  const indexados = files.reduce((acc, f) => acc + f.chunk_count, 0);

  async function borrar(f: StoredFile): Promise<void> {
    setBorrando(true);
    setError('');
    setAviso('');
    try {
      await deleteProjectFile(f.project_id, f.id);
      setConfirmBorrar(null);
      await refrescar();
      setAviso(`«${f.filename}» eliminado.`);
    } catch (e) {
      setError(
        e instanceof AuthHttpError ? mensajeError(e.status, e.message) : (e as Error).message,
      );
    } finally {
      setBorrando(false);
    }
  }

  async function descargar(f: StoredFile): Promise<void> {
    setDescargando(f.id);
    setError('');
    try {
      const blob = await downloadFile(f.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = f.filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 5000);
    } catch (e) {
      setError(
        e instanceof AuthHttpError ? mensajeError(e.status, e.message) : (e as Error).message,
      );
    } finally {
      setDescargando(null);
    }
  }

  return (
    <div className="page" aria-label="Documentos">
      <div className="page-head">
        <div>
          <span className="eyebrow">
            <FolderOpen size={13} /> Archivos y contexto
          </span>
          <h1 className="page-title">Documentos</h1>
          <p className="page-sub">
            Archivos que has cargado en tus proyectos. Se indexan por fragmentos para que el
            asistente pueda consultarlos junto con el corpus normativo.
          </p>
        </div>
        <div className="page-actions">
          {usage && (
            <span className="chip">
              {usage.count} archivo(s) · {tamanoLegible(usage.bytes)}
            </span>
          )}
          <Button type="button" variant="outline" onClick={() => void refrescar()} disabled={loading}>
            <RefreshCw />
            Actualizar
          </Button>
        </div>
      </div>

      <div className="stat-grid grid-cols-3 max-[760px]:grid-cols-2" style={{ marginBottom: 'var(--space-4)' }}>
        <div className="stat">
          <div className="stat-value">{loading ? '—' : files.length}</div>
          <div className="stat-label">Documentos</div>
        </div>
        <div className="stat">
          <div className="stat-value">{loading ? '—' : indexados}</div>
          <div className="stat-label">Fragmentos indexados</div>
        </div>
        <div className="stat">
          <div className="stat-value">{usage ? tamanoLegible(usage.bytes) : '—'}</div>
          <div className="stat-label">Almacenamiento</div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">
          <h2>Archivos cargados</h2>
          <span className="chip">
            <ShieldCheck size={11} /> Aislados por cuenta
          </span>
        </div>

        <div style={{ padding: 'var(--space-4) var(--space-5) 0' }}>
          <div className="filter-bar">
            <label style={{ position: 'relative', flex: '1 1 240px', maxWidth: 360 }}>
              <Search
                size={14}
                style={{
                  position: 'absolute',
                  left: 10,
                  top: 10,
                  color: 'var(--muted)',
                  pointerEvents: 'none',
                }}
              />
              <Input
                type="search"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Buscar por nombre o proyecto…"
                aria-label="Buscar por nombre o proyecto"
                className="w-full pl-9"
              />
            </label>
            <Select
              value={proyecto || 'all'}
              onValueChange={(value) => setProyecto(value === 'all' ? '' : value)}
            >
              <SelectTrigger className="min-w-[190px]" aria-label="Filtrar por proyecto">
                <SelectValue placeholder="Todos los proyectos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los proyectos</SelectItem>
                {proyectos.map(([id, name]) => (
                  <SelectItem key={id} value={id}>
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {(busqueda || proyecto) && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8"
                onClick={() => {
                  setBusqueda('');
                  setProyecto('');
                }}
              >
                Limpiar
              </Button>
            )}
          </div>
        </div>

        {aviso && (
          <div className="px-5 pt-3">
            <Alert className="border-primary/20 bg-primary/5">
              <ShieldCheck className="text-primary" />
              <AlertDescription className="text-foreground">{aviso}</AlertDescription>
            </Alert>
          </div>
        )}
        {error && (
          <div className="px-5 pt-3">
            <Alert variant="destructive" className="border-destructive/30 bg-destructive/5">
              <AlertDescription>
                {error}{' '}
                <Button
                  type="button"
                  variant="link"
                  size="sm"
                  className="h-auto p-0 text-xs"
                  onClick={() => void refrescar()}
                >
                  Reintentar
                </Button>
              </AlertDescription>
            </Alert>
          </div>
        )}

        {loading && (
          <div style={{ padding: 'var(--space-4) var(--space-5)' }}>
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="skeleton"
                style={{ height: 26, margin: '0.6rem 0', width: `${88 - i * 9}%` }}
              />
            ))}
          </div>
        )}

        {!loading && files.length === 0 && !error && (
          <div className="empty-state">
            <span className="empty-icon">
              <Upload size={18} />
            </span>
            <strong>Sin documentos todavía</strong>
            <p>
              Abre el asistente, elige un proyecto y sube un archivo .txt o .md. Quedará disponible
              para tus consultas de ese proyecto.
            </p>
          </div>
        )}

        {!loading && files.length > 0 && visibles.length === 0 && (
          <div className="empty-state">
            <span className="empty-icon">
              <Search size={18} />
            </span>
            <strong>Sin coincidencias</strong>
            <p>Cambia el texto de búsqueda o el filtro de proyecto.</p>
          </div>
        )}

        {visibles.length > 0 && (
          <ul className="archivos-lista" style={{ padding: '0 var(--space-5) var(--space-3)' }}>
            {visibles.map((f) => (
              <li key={f.id}>
                <span className="row-icon">
                  <FileText size={15} />
                </span>
                <div className="archivo-info" style={{ flex: 1 }}>
                  <strong title={f.filename}>{f.filename}</strong>
                  <span>
                    {f.project_name} · {tamanoLegible(f.size_bytes)} · {f.chunk_count} fragmento(s) ·{' '}
                    {fechaLegible(f.created_at)}
                    {f.sospechoso ? ' · revisar: posible contenido de instrucciones' : ''}
                  </span>
                </div>
                <div className="side-actions">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 gap-1 px-2 text-xs"
                    disabled={descargando === f.id}
                    title={`Descargar ${f.filename}`}
                    onClick={() => void descargar(f)}
                  >
                    <Download /> {descargando === f.id ? '…' : 'Descargar'}
                  </Button>
                  {confirmBorrar === f.id ? (
                    <>
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        className="h-7 px-2 text-xs"
                        disabled={borrando}
                        onClick={() => void borrar(f)}
                      >
                        {borrando ? '…' : 'Confirmar'}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs"
                        disabled={borrando}
                        onClick={() => setConfirmBorrar(null)}
                      >
                        Cancelar
                      </Button>
                    </>
                  ) : (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 gap-1 px-2 text-xs text-destructive hover:text-destructive"
                      title={`Borrar ${f.filename}`}
                      onClick={() => setConfirmBorrar(f.id)}
                    >
                      <Trash2 /> Borrar
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <section className="panel panel-pad" style={{ marginTop: 'var(--space-4)' }}>
        <div className="section-head">
          <h2 className="section-title">Análisis documental</h2>
          <span className="chip chip-warn">Integración pendiente</span>
        </div>
        <p className="meta" style={{ fontSize: 'var(--text-sm)', lineHeight: 1.65 }}>
          Hoy el backend indexa archivos .txt y .md por fragmentos para consultarlos desde el
          asistente. No existen aún endpoints de extracción de PDF/DOCX, resumen automático,
          detección de cláusulas o comparación documental, por lo que estas funciones no se simulan
          en la interfaz.
        </p>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 'var(--space-3)' }}>
          <span className="chip chip-ok">Indexación TXT/MD</span>
          <span className="chip chip-ok">Consulta con contexto de proyecto</span>
          <span className="chip">PDF/DOCX · pendiente</span>
          <span className="chip">Extracción y cláusulas · pendiente</span>
        </div>
      </section>
    </div>
  );
}
