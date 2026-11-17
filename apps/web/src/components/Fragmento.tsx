import { useEffect, useState } from 'react';
import { Check, Copy, ExternalLink, FileText, Loader2, Quote, ShieldAlert } from 'lucide-react';
import type { Chunk } from '../api';
import { api } from '../api';
import { AuthHttpError, mensajeError } from '../auth';
import { getCitaChat, type CitaChat } from '../chatApi';
import { Alert, AlertDescription } from './ui/alert';
import { Button } from './ui/button';

// Visor de citas con dos modos:
// - corpus (por defecto): GET /search/chunk/:id público. Lo usa Investigar.
// - chat: GET /chat/citas/:id autenticado; renderiza corpus o proyecto.
export function textoVigencia(v: string): string {
  if (v === 'texto_original') return 'Texto original';
  if (v === 'modificado') return 'Modificado';
  if (v === 'consolidado') return 'Consolidado';
  if (v === 'vigencia_verificada') return 'Vigencia verificada';
  return 'Vigencia no verificada';
}

function claseVigencia(v: string): string {
  if (v === 'vigencia_verificada') return 'chip chip-ok';
  if (v === 'modificado') return 'chip chip-warn';
  return 'chip';
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
  const [copiado, setCopiado] = useState(false);

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

  const doc =
    modo === 'chat' && cita && cita.fuente !== 'proyecto'
      ? {
          titulo: cita.doc.titulo,
          numero: cita.doc.numero,
          tipo: cita.doc.tipo,
          url: cita.doc.url_original,
          vigencia: cita.doc.vigencia,
          autoridad: cita.doc.autoridad,
          fecha: cita.doc.fecha_consulta,
          ruta: cita.ruta,
          texto: cita.texto,
          contexto: cita.texto_contexto,
        }
      : c
        ? {
            titulo: c.doc.titulo,
            numero: c.doc.numero,
            tipo: c.doc.tipo,
            url: c.doc.url_original,
            vigencia: c.doc.vigencia,
            autoridad: c.doc.autoridad,
            fecha: c.doc.fecha_consulta,
            ruta: c.ruta,
            texto: c.texto,
            contexto: c.texto_contexto,
          }
        : null;

  const esProyecto = modo === 'chat' && cita?.fuente === 'proyecto';

  function copiar(): void {
    if (!doc) return;
    void navigator.clipboard
      ?.writeText(`${doc.titulo}\n${doc.ruta}\n\n${doc.texto}`)
      .then(() => {
        setCopiado(true);
        window.setTimeout(() => setCopiado(false), 1600);
      })
      .catch(() => undefined);
  }

  return (
    <aside className="fragmento">
      {!chunkId && (
        <>
          <div className="fragmento-head">
            <span className="chip">
              <Quote size={11} /> Evidencia documental
            </span>
            <h3>Consulta las fuentes</h3>
          </div>
          <p className="meta" style={{ fontSize: 'var(--text-xs)', lineHeight: 1.65 }}>
            Cuando la respuesta cite una referencia, pulsa el número o la fuente para leer el
            fragmento exacto que la respalda, junto con su autoridad y estado de vigencia.
          </p>
          <div className="meta-grid">
            <div>
              <dt>Documento</dt>
              <dd>Nombre y tipo de norma</dd>
            </div>
            <div>
              <dt>Referencia</dt>
              <dd>Artículo o sección</dd>
            </div>
            <div>
              <dt>Fuente</dt>
              <dd>Autoridad y enlace oficial</dd>
            </div>
            <div>
              <dt>Vigencia</dt>
              <dd>Estado declarado en el corpus</dd>
            </div>
          </div>
          <Alert className="mt-2 border-warn/30 bg-warn/5">
            <ShieldAlert className="text-[var(--warn)]" />
            <AlertDescription>
              La vigencia puede haber cambiado. Contrasta siempre el fragmento con la publicación
              oficial antes de actuar.
            </AlertDescription>
          </Alert>
        </>
      )}

      {loading && (
        <div className="empty-state" style={{ padding: 'var(--space-6) 0' }}>
          <Loader2 size={18} className="spin" />
          <p className="meta">Cargando fragmento…</p>
        </div>
      )}

      {error && (
        <Alert variant="destructive" className="border-destructive/30 bg-destructive/5">
          <ShieldAlert />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {esProyecto && cita && cita.fuente === 'proyecto' && (
        <>
          <div className="fragmento-head">
            <div className="fragmento-type">
              <span className="chip chip-accent">Documento del proyecto</span>
            </div>
            <h3>{cita.filename}</h3>
            <p className="ruta">{cita.ruta}</p>
          </div>
          <blockquote>{cita.texto}</blockquote>
          <p className="meta" style={{ fontSize: 'var(--text-xs)' }}>
            {cita.texto_contexto}
          </p>
        </>
      )}

      {doc && !esProyecto && (
        <>
          <div className="fragmento-head">
            <div className="fragmento-type">
              <span className="chip chip-accent">{doc.tipo}</span>
              {doc.numero && <span className="chip">{doc.numero}</span>}
              <span className={claseVigencia(doc.vigencia)}>{textoVigencia(doc.vigencia)}</span>
            </div>
            <h3>{doc.titulo}</h3>
            <p className="ruta">{doc.ruta}</p>
          </div>

          <dl className="meta-grid">
            <div>
              <dt>Autoridad</dt>
              <dd>{doc.autoridad || 'No declarada'}</dd>
            </div>
            <div>
              <dt>Fecha de consulta</dt>
              <dd>{doc.fecha ?? 'No registrada'}</dd>
            </div>
            <div>
              <dt>Identificador</dt>
              <dd style={{ fontFamily: 'var(--font-mono)', fontSize: '0.66rem' }}>
                {chunkId?.slice(0, 13)}…
              </dd>
            </div>
          </dl>

          <blockquote>{doc.texto}</blockquote>

          <details>
            <summary>Contexto recuperado</summary>
            <p className="meta" style={{ marginTop: 'var(--space-2)', fontSize: 'var(--text-xs)' }}>
              {doc.contexto}
            </p>
          </details>

          <div className="fragmento-actions">
            {doc.url && (
              <Button asChild variant="outline" size="sm">
                <a href={doc.url} target="_blank" rel="noreferrer">
                  <ExternalLink /> Fuente oficial
                </a>
              </Button>
            )}
            <Button type="button" variant="ghost" size="sm" className="h-7 gap-1 px-2 text-xs" onClick={copiar}>
              {copiado ? <Check /> : <Copy />}
              {copiado ? ' Copiado' : ' Copiar fragmento'}
            </Button>
          </div>

          <Alert className="border-border bg-muted/40">
            <FileText />
            <AlertDescription>
              Fragmento recuperado del corpus indexado. Verifica el texto y la vigencia en la
              publicación oficial.
            </AlertDescription>
          </Alert>
        </>
      )}
    </aside>
  );
}
