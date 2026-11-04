import { useEffect, useState } from 'react';
import type { Informe } from '../api';
import { API, api } from '../api';
import Fragmento from './Fragmento';
import Secop from './Secop';

// Vista Investigar: comportamiento idéntico al App.tsx original
// (investigar → informe, Secop, Fragmento).

const MARCA: Record<string, { mark: string; label: string }> = {
  verificada: { mark: '✓', label: 'verificada' },
  parcial: { mark: '~', label: 'parcial' },
  no_verificada: { mark: '✗', label: 'sin verificar' },
  sin_respaldo: { mark: '○', label: 'sin respaldo' },
  cita_inventada: { mark: '⛔', label: 'inventada' },
};

const EJEMPLOS = [
  '¿Qué dice el artículo 24 de la Ley 80 de 1993 sobre transparencia?',
  '¿Qué contratos de software hay? Indica modalidad y valores.',
  '¿Qué dice la Constitución sobre el derecho de petición?',
];

export default function Investigar(): React.ReactElement {
  const [pregunta, setPregunta] = useState('');
  const [loading, setLoading] = useState(false);
  const [paso, setPaso] = useState('');
  const [error, setError] = useState('');
  const [informe, setInforme] = useState<Informe | null>(null);
  const [cita, setCita] = useState<string | null>(null);
  const [salud, setSalud] = useState('…');

  useEffect(() => {
    api.health().then(
      (h) => setSalud(h.status),
      () => setSalud('sin conexión'),
    );
  }, []);

  async function investigar(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    if (!pregunta.trim() || loading) return;
    setLoading(true);
    setError('');
    setInforme(null);
    setCita(null);
    try {
      setPaso('El agente investiga con normas, jurisprudencia y SECOP…');
      const inv = await api.investigar(pregunta.trim());
      setPaso('Verificando citas y armando el informe…');
      const rep = await api.informe(inv.id);
      setInforme(rep);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
      setPaso('');
    }
  }

  function descargar(): void {
    if (!informe) return;
    const blob = new Blob([informe.markdown], { type: 'text/markdown' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `informe-${informe.id.slice(0, 8)}.md`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <>
      <div className="investigar-head">
        <p className="salud" title={API}>API: {salud}</p>
      </div>
      <div className="layout">
        <main>
          <section>
            <h2>Investigar</h2>
            <form className="pregunta" onSubmit={(e) => void investigar(e)}>
              <input
                value={pregunta}
                onChange={(e) => setPregunta(e.target.value)}
                placeholder="Pregunta sobre contratación estatal, normas o contratos…"
              />
              <button type="submit" disabled={loading}>{loading ? 'Investigando…' : 'Investigar'}</button>
            </form>
            <div className="ejemplos">
              {EJEMPLOS.map((q) => (
                <button key={q} type="button" className="ejemplo" onClick={() => setPregunta(q)}>{q}</button>
              ))}
            </div>
            {paso && <p className="meta" role="status">{paso}</p>}
            {error && <p className="error">{error}</p>}
          </section>

          {informe && (
            <section>
              <div className="informe-head">
                <h2>Informe</h2>
                <button type="button" onClick={descargar}>Descargar Markdown</button>
              </div>
              <p className="pregunta-hecha">{informe.pregunta}</p>
              <h3>Resumen</h3>
              <p>{informe.resumen || '—'}</p>
              <h3>Afirmaciones ({informe.verificacion.afirmaciones.length})</h3>
              {informe.verificacion.afirmaciones.map((a) => {
                const m = MARCA[a.veredicto] ?? { mark: '?', label: a.veredicto };
                return (
                  <article key={a.idx} className="afirmacion">
                    <p><span className={`veredicto v-${a.veredicto}`}>{m.mark} {m.label}</span></p>
                    <p>{a.texto}</p>
                    <div className="citas">
                      {a.chunk_ids.map((id) => (
                        <button key={id} type="button" className="cita" onClick={() => setCita(id)}>
                          {rutaCorta(informe, id)} · {id.slice(0, 8)}
                        </button>
                      ))}
                      {a.secop_refs.map((ref) => (
                        <span key={ref} className="cita secop" title="Contrato SECOP citado">{ref}</span>
                      ))}
                      {a.chunk_ids.length === 0 && a.secop_refs.length === 0 && (
                        <span className="meta">sin citas</span>
                      )}
                    </div>
                    {a.motivo_soporte && <p className="meta">Juez: {a.motivo_soporte}</p>}
                  </article>
                );
              })}
              <details>
                <summary>Traza y costo (investigación {informe.id.slice(0, 8)}, ${informe.costo_usd} USD)</summary>
                <ul>
                  {informe.traza.map((p) => (
                    <li key={p.paso}>Paso {p.paso}: {p.tool_calls.map((t) => t.name).join(', ')}</li>
                  ))}
                </ul>
              </details>
            </section>
          )}

          <Secop />
        </main>
        <Fragmento chunkId={cita} />
      </div>
    </>
  );
}

function rutaCorta(informe: Informe, chunkId: string): string {
  return informe.fuentes.find((f) => f.chunk_id === chunkId)?.ruta ?? 'fragmento';
}
