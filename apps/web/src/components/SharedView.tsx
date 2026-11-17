import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { getSharedConversation, type SharedCitation, type SharedMessage } from '../chatApi';
import Markdown from './Markdown';
import { Alert, AlertDescription } from './ui/alert';
import { Button } from './ui/button';

// Vista pública de enlace compartido (B9). Sin login: el token opaco es la
// credencial y se revoca con "Revocar" en el hilo original.
//
// Ruta canónica: /s/TOKEN. Se acepta ?share=TOKEN por compatibilidad con
// enlaces antiguos; App.tsx los normaliza antes de montar esta vista.
// Si no hay token, esta vista no se monta (ver App.tsx).

export function leerTokenCompartido(
  ruta = `${window.location.pathname}${window.location.search}`,
): string | null {
  try {
    const url = new URL(ruta, window.location.origin);
    const path = url.pathname.match(/^\/s\/([^/]+)\/?$/);
    if (path) return decodeURIComponent(path[1]);
    const q = url.searchParams.get('share');
    if (q && q.trim()) return q.trim();
  } catch {
    // URL ilegible: sin token
  }
  return null;
}

/** Convierte una cita pública (sin chunk_id) al Citation interno: solo texto. */
function citaPublica(c: SharedCitation): {
  n: number;
  chunk_id: string | null;
  secop_ref: string | null;
  ruta: string;
  titulo: string;
} {
  return { n: c.n, chunk_id: null, secop_ref: null, ruta: c.ruta, titulo: c.titulo };
}

export default function SharedView({ token }: { token: string }): ReactNode {
  const [titulo, setTitulo] = useState('');
  const [mensajes, setMensajes] = useState<SharedMessage[]>([]);
  const [cita, setCita] = useState<SharedCitation | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let vivo = true;
    setCargando(true);
    setError('');
    getSharedConversation(token)
      .then((b) => {
        if (!vivo) return;
        setTitulo(b.conversation.title);
        setMensajes(b.messages);
      })
      .catch((e: Error) => {
        if (!vivo) return;
        setError(e.message || 'enlace no válido o revocado');
      })
      .finally(() => {
        if (vivo) setCargando(false);
      });
    return () => {
      vivo = false;
    };
  }, [token]);

  if (cargando) return <p className="meta centro">Cargando conversación compartida…</p>;
  if (error) {
    return (
      <div className="share-publica">
        <h2>Enlace compartido</h2>
        <Alert variant="destructive" className="border-destructive/30 bg-destructive/5">
          <AlertDescription>
            {error.includes('revocado') || error.includes('válido') ? error : 'enlace no válido o revocado'}
          </AlertDescription>
        </Alert>
        <p className="meta">Pide al dueño un enlace nuevo o verifica que no haya sido revocado.</p>
      </div>
    );
  }

  return (
    <div className="share-publica">
      <h2>{titulo || 'Conversación compartida'}</h2>
      <p className="meta">Vista pública de solo lectura. No es asesoría jurídica.</p>
      <ol className="hilo">
        {mensajes.map((m, i) =>
          m.role === 'user' ? (
            <li key={i} className="burbuja user">
              <p>{m.content}</p>
            </li>
          ) : (
            <li key={i} className="burbuja assistant">
              <Markdown
                content={m.content}
                citations={m.citations.map(citaPublica)}
                onCita={(c) => setCita({ n: c.n, ruta: c.ruta, titulo: c.titulo })}
              />
              {m.citations.length > 0 && (
                <div className="citas">
                  {m.citations.map((c) => (
                    <Button
                      key={c.n}
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-auto px-2 py-1 text-xs"
                      onClick={() => setCita(c)}
                    >
                      [{c.n}] {c.ruta.slice(0, 60)}
                    </Button>
                  ))}
                </div>
              )}
            </li>
          ),
        )}
      </ol>
      {cita && (
        <aside className="fragmento">
          <h2>Cita [{cita.n}]</h2>
          <p className="ruta">{cita.ruta}</p>
          <p className="meta">{cita.titulo}</p>
          <p className="meta">Fuente completa disponible para el dueño en la app.</p>
          <Button type="button" variant="outline" size="sm" onClick={() => setCita(null)}>
            Cerrar
          </Button>
        </aside>
      )}
    </div>
  );
}
