import { useEffect, useRef, useState } from 'react';
import { AuthHttpError, mensajeError } from '../auth';
import {
  deleteProjectFile,
  listProjectFiles,
  uploadProjectFile,
  type FilesUsage,
  type ProjectFile,
} from '../chatApi';
import { fechaLegible, tamanoLegible } from '../shared/formato';

/** Mensaje honesto según el error real del backend (B6). */
function describeUploadError(e: unknown): string {
  if (e instanceof AuthHttpError) {
    if (e.status === 413) return 'Archivo muy grande: máximo 10 MB por archivo.';
    if (e.status === 503) {
      return 'Servicio de embeddings no disponible; reintenta en un momento.';
    }
    if (e.status === 400 || e.status === 404) return e.message;
    return mensajeError(e.status, e.message);
  }
  if (e instanceof TypeError) return 'Sin conexión con la API (¿corre en :3000?).';
  return (e as Error).message;
}

/** Sección Archivos dentro del contexto de un proyecto (B6). */
export default function ArchivosProyecto({
  projectId,
  projectName,
  onCambio,
}: {
  projectId: string;
  projectName: string;
  onCambio?: () => void;
}): React.ReactElement {
  const [files, setFiles] = useState<ProjectFile[]>([]);
  const [usage, setUsage] = useState<FilesUsage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');
  const [subiendo, setSubiendo] = useState(false);
  const [confirmBorrar, setConfirmBorrar] = useState<string | null>(null);
  const [borrando, setBorrando] = useState(false);
  const [eraVacio, setEraVacio] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  async function refrescar(): Promise<void> {
    setLoading(true);
    setError('');
    try {
      const r = await listProjectFiles(projectId);
      setFiles(r.files);
      setUsage(r.usage);
      setEraVacio(r.files.length === 0);
    } catch (e) {
      setError(
        e instanceof AuthHttpError ? mensajeError(e.status, e.message) : (e as Error).message,
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setAviso('');
    setConfirmBorrar(null);
    void refrescar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  async function subir(seleccion: FileList | null): Promise<void> {
    const f = seleccion?.[0];
    if (!f || subiendo) return;
    setSubiendo(true);
    setError('');
    setAviso('');
    try {
      const r = await uploadProjectFile(projectId, f);
      await refrescar();
      const base = r.duplicado
        ? `«${r.file.filename}»: ya existe este archivo (duplicado).`
        : eraVacio
          ? 'Archivo listo. Pregunta por el contenido de tus archivos en un chat de este proyecto.'
          : `«${r.file.filename}» subido (${r.file.chunk_count} fragmentos).`;
      // B10: advertencia anti-inyección (el archivo sí quedó indexado).
      setAviso(r.advertencia ? `${base} Advertencia: ${r.advertencia}.` : base);
      onCambio?.();
    } catch (e) {
      setError(describeUploadError(e));
    } finally {
      setSubiendo(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  async function borrar(fileId: string): Promise<void> {
    setBorrando(true);
    setError('');
    setAviso('');
    try {
      const msg = await deleteProjectFile(projectId, fileId);
      setConfirmBorrar(null);
      await refrescar();
      setAviso(msg || 'Archivo eliminado.');
      onCambio?.();
    } catch (e) {
      setError(
        e instanceof AuthHttpError ? mensajeError(e.status, e.message) : (e as Error).message,
      );
    } finally {
      setBorrando(false);
    }
  }

  return (
    <section className="archivos" aria-label={`Archivos del proyecto ${projectName}`}>
      <div className="archivos-head">
        <h3>Archivos de «{projectName}»</h3>
        {usage && (
          <p className="meta">
            {usage.count}/{usage.max_files} archivos · {tamanoLegible(usage.bytes)}/
            {tamanoLegible(usage.max_bytes)}
          </p>
        )}
      </div>
      {usage && (
        <div className="cuota" role="img" aria-label={`Cuota: ${usage.count} de ${usage.max_files} archivos`}>
          <div
            className="cuota-barra"
            style={{ width: `${Math.min(100, (usage.count / usage.max_files) * 100)}%` }}
          />
        </div>
      )}
      <div className="archivos-subir">
        <input
          ref={inputRef}
          type="file"
          accept=".txt,.md,text/plain,text/markdown"
          disabled={subiendo}
          onChange={(e) => void subir(e.target.files)}
          aria-label="Subir archivo .txt o .md"
        />
        {subiendo && <p className="meta" role="status">Subiendo y procesando…</p>}
      </div>
      <p className="meta">Solo .txt y .md (máx. 10 MB por archivo). PDF/DOCX aún no soportados.</p>
      {aviso && <p className="ok">{aviso}</p>}
      {error && <p className="error" role="alert">{error}</p>}
      {loading && <p className="meta">Cargando archivos…</p>}
      {!loading && files.length === 0 && !error && (
        <p className="meta">Sin archivos. Sube un .txt o .md para preguntar sobre su contenido.</p>
      )}
      {files.length > 0 && (
        <ul className="archivos-lista">
          {files.map((f) => (
            <li key={f.id}>
              <div className="archivo-info">
                <strong title={f.filename}>{f.filename}</strong>
                <span className="meta">
                  {tamanoLegible(f.size_bytes)} · {f.chunk_count} fragmento(s) ·{' '}
                  {fechaLegible(f.created_at)}
                  {f.sospechoso ? ' · [revisar: parece contener instrucciones]' : ''}
                </span>
              </div>
              {confirmBorrar === f.id ? (
                <div className="side-actions">
                  <button
                    type="button"
                    className="mini danger"
                    disabled={borrando}
                    onClick={() => void borrar(f.id)}
                  >
                    {borrando ? '…' : '¿Sí?'}
                  </button>
                  <button
                    type="button"
                    className="mini"
                    disabled={borrando}
                    onClick={() => setConfirmBorrar(null)}
                  >
                    No
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  className="mini danger"
                  title={`Borrar ${f.filename}`}
                  onClick={() => setConfirmBorrar(f.id)}
                >
                  🗑 Borrar
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
