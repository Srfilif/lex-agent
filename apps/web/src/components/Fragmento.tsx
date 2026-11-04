import { useEffect, useState } from 'react';
import type { Chunk } from '../api';
import { api } from '../api';
import { AuthHttpError, mensajeError } from '../auth';
import { getCitaChat, type CitaChat } from '../chatApi';

// Visor de citas con dos modos:
// - corpus (por defecto): GET /search/chunk/:id público. Lo usa Investigar.
// - chat: GET /chat/citas/:id autenticado; renderiza corpus o proyecto.
function textoVigencia(v: string): string {
  if (v === 'texto_original') return 'texto original';
  if (v === 'modificado') return 'modificado';
  if (v === 'consolidado') return 'consolidado';
  if (v === 'vigencia_verificada') return 'vigencia verificada';
  return 'vigencia no verificada';
}
export default function Fragmento({
  chunkId,
  modo = 'corpus',
}: {
  chunkId: string | null;
  modo?: 'corpus' | 'chat';
}): React.ReactElement {
  const [c, setC] = useState<Chunk | null>(null);
  const [cita, setCita] = useState<CitaChat | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!chunkId) return;
    setLoading(true);
    setError('');
    if (modo === 'chat') {
      setCita(null);
      getCitaChat(chunkId)
        .then(setCita)
        .catch((e: Error) => {
          if (e instanceof AuthHttpError && e.status === 404) {
            setError('Fragmento no encontrado o de otro usuario.');
          } else if (e instanceof AuthHttpError) {
            setError(mensajeError(e.status, e.message));
          } else {
            setError(e.message);
          }
        })
        .finally(() => setLoading(false));
    } else {
      setC(null);
      api
        .chunk(chunkId)
        .then(setC)
        .catch((e: Error) => setError(e.message))
        .finally(() => setLoading(false));
    }
  }, [chunkId, modo]);

  return (
    <aside className="fragmento">
      <h2>Fragmento citado</h2>
      {!chunkId && <p className="meta">Pulsa una cita de una afirmación para leer el fragmento exacto que la respalda.</p>}
      {loading && <p className="meta">Cargando…</p>}
      {error && <p className="error">{error}</p>}
      {modo === 'corpus' && c && (
        <>
          <p className="ruta">{c.ruta}</p>
          <p className="meta">{c.doc.titulo} · <a href={c.doc.url_original} target="_blank" rel="noreferrer">origen oficial</a></p>
          <p className="meta">Vigencia: {textoVigencia(c.doc.vigencia)} · Autoridad: {c.doc.autoridad}{c.doc.fecha_consulta ? ` · Consultado: ${c.doc.fecha_consulta}` : ''}</p>
          <blockquote>{c.texto}</blockquote>
          <p className="meta">Contexto: {c.texto_contexto}</p>
        </>
      )}
      {modo === 'chat' && cita && cita.fuente !== 'proyecto' && (
        <>
          <p className="ruta">{cita.ruta}</p>
          <p className="meta">
            {cita.doc.titulo} ·{' '}
            <a href={cita.doc.url_original} target="_blank" rel="noreferrer">
              origen oficial
            </a>
          </p>
          <p className="meta">Vigencia: {textoVigencia(cita.doc.vigencia)} · Autoridad: {cita.doc.autoridad}{cita.doc.fecha_consulta ? ` · Consultado: ${cita.doc.fecha_consulta}` : ''}</p>
          <blockquote>{cita.texto}</blockquote>
          <p className="meta">Contexto: {cita.texto_contexto}</p>
        </>
      )}
      {modo === 'chat' && cita && cita.fuente === 'proyecto' && (
        <>
          <p className="ruta">{cita.ruta}</p>
          <p className="meta">Archivo del proyecto: {cita.filename}</p>
          <blockquote>{cita.texto}</blockquote>
          <p className="meta">Contexto: {cita.texto_contexto}</p>
        </>
      )}
    </aside>
  );
}
