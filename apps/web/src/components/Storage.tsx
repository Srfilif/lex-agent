import { useEffect, useMemo, useState } from 'react';
import { AuthHttpError, mensajeError } from '../auth';
import {
  deleteProjectFile,
  downloadFile,
  listAllFiles,
  type StorageUsage,
  type StoredFile,
} from '../chatApi';
import { fechaLegible, tamanoLegible } from '../shared/formato';

// Pestaña Storage: todo lo subido por el usuario en todos los proyectos,
// con descarga y borrado. Rutas: #/storage y #/settings/storage.

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
    <section className="archivos" aria-label="Almacenamiento: todos tus archivos">
      <div className="archivos-head">
        <h2>Archivos subidos</h2>
        {usage && (
          <p className="meta">
            {usage.count} archivo(s) · {tamanoLegible(usage.bytes)} en total
          </p>
        )}
      </div>
      <p className="meta">
        Todo lo que subiste en tus proyectos. Para subir, entra al proyecto; aquí descargas o liberas espacio.
      </p>
      <div className="fila">
        <label>
          Buscar{' '}
          <input
            type="search"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Nombre o proyecto…"
            aria-label="Buscar por nombre o proyecto"
          />
        </label>
        <label>
          Proyecto{' '}
          <select
            value={proyecto}
            onChange={(e) => setProyecto(e.target.value)}
            aria-label="Filtrar por proyecto"
          >
            <option value="">Todos</option>
            {proyectos.map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <button type="button" className="mini" onClick={() => void refrescar()} disabled={loading}>
          Actualizar
        </button>
      </div>
      {aviso && <p className="ok">{aviso}</p>}
      {error && (
        <p className="error" role="alert">
          {error}{' '}
          <button type="button" className="mini" onClick={() => void refrescar()}>
            Reintentar
          </button>
        </p>
      )}
      {loading && <p className="meta">Cargando archivos…</p>}
      {!loading && files.length === 0 && !error && (
        <p className="meta">Sin archivos. Sube un .txt o .md desde un proyecto.</p>
      )}
      {!loading && files.length > 0 && visibles.length === 0 && (
        <p className="meta">Sin coincidencias para este filtro.</p>
      )}
      {visibles.length > 0 && (
        <ul className="archivos-lista">
          {visibles.map((f) => (
            <li key={f.id}>
              <div className="archivo-info">
                <strong title={f.filename}>{f.filename}</strong>
                <span className="meta">
                  {f.project_name} · {tamanoLegible(f.size_bytes)} · {f.chunk_count}{' '}
                  fragmento(s) · {fechaLegible(f.created_at)}
                  {f.sospechoso ? ' · [revisar: parece contener instrucciones]' : ''}
                </span>
              </div>
              <div className="side-actions">
                <button
                  type="button"
                  className="mini"
                  disabled={descargando === f.id}
                  title={`Descargar ${f.filename}`}
                  onClick={() => void descargar(f)}
                >
                  {descargando === f.id ? '…' : '⬇ Descargar'}
                </button>
                {confirmBorrar === f.id ? (
                  <>
                    <button
                      type="button"
                      className="mini danger"
                      disabled={borrando}
                      onClick={() => void borrar(f)}
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
                  </>
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
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
