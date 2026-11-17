import { useEffect, useState } from 'react';
import {
  Activity,
  BookOpen,
  Download,
  FileSearch,
  Landmark,
  Loader2,
  Scale,
  Search,
  ShieldCheck,
  TriangleAlert,
} from 'lucide-react';
import type { Informe } from '../api';
import { API, api } from '../api';
import Fragmento from './Fragmento';
import Secop from './Secop';
import { Alert, AlertDescription } from './ui/alert';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';

// Vista Investigar: comportamiento idéntico al App.tsx original
// (investigar → informe, Secop, Fragmento), con composición renovada.

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
    <div className="page">
      <div className="page-head">
        <div>
          <span className="eyebrow">
            <FileSearch size={13} /> Investigación avanzada
          </span>
          <h1 className="page-title">Investigación jurídica</h1>
          <p className="page-sub">
            Plantea una pregunta compleja y obtén un informe con normas, jurisprudencia y contratos
            citados. Cada afirmación se clasifica según el respaldo documental encontrado.
          </p>
        </div>
        <div className="page-actions">
          <Badge variant="outline" className="gap-1.5 bg-card px-2 py-1 text-[10px] font-normal text-muted-foreground" title={API}>
            <span className={`status-dot${salud === 'ok' ? '' : ' warn'}`} />
            API: {salud}
          </Badge>
        </div>
      </div>

      <section className="invest-hero">
        <form className="invest-form" onSubmit={(e) => void investigar(e)}>
          <label
            htmlFor="pregunta-investigacion"
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <Scale size={14} /> Pregunta de investigación
          </label>
          <Textarea
            id="pregunta-investigacion"
            value={pregunta}
            onChange={(e) => setPregunta(e.target.value)}
            placeholder="Ej.: ¿Bajo qué condiciones puede la administración celebrar un contrato de prestación de servicios sin convocatoria pública?"
            className="min-h-28"
          />
          <div className="invest-form-foot">
            <div className="ejemplos" style={{ margin: 0 }}>
              {EJEMPLOS.map((q) => (
                <button key={q} type="button" className="ejemplo" onClick={() => setPregunta(q)}>
                  {q}
                </button>
              ))}
            </div>
            <Button type="submit" disabled={loading || !pregunta.trim()}>
              {loading ? (
                <>
                  <Loader2 className="animate-spin" />
                  Investigando…
                </>
              ) : (
                <>
                  <Search /> Investigar
                </>
              )}
            </Button>
          </div>
        </form>
        {paso && (
          <p className="meta" role="status" style={{ marginTop: 'var(--space-3)' }}>
            <Activity size={13} style={{ verticalAlign: '-2px' }} /> {paso}
          </p>
        )}
        {error && (
          <Alert variant="destructive" className="mt-3 border-destructive/30 bg-destructive/5">
            <TriangleAlert />
            <AlertDescription>La investigación falló: {error}</AlertDescription>
          </Alert>
        )}
      </section>

      <div className="layout">
        <div>
          {informe ? (
            <section className="panel panel-pad">
              <div className="informe-head">
                <div>
                  <span className="eyebrow">
                    <ShieldCheck size={13} /> Informe verificado
                  </span>
                  <h2 className="page-title" style={{ fontSize: 'var(--text-xl)' }}>
                    Informe de investigación
                  </h2>
                </div>
                <Button type="button" variant="outline" onClick={descargar}>
                  <Download />
                  Descargar Markdown
                </Button>
              </div>
              <p className="pregunta-hecha">{informe.pregunta}</p>

              <div className="informe-section">
                <h3>Resumen</h3>
                <p style={{ lineHeight: 1.7 }}>{informe.resumen || '—'}</p>
              </div>

              <div className="informe-section">
                <h3>
                  Afirmaciones y respaldo ({informe.verificacion.afirmaciones.length})
                </h3>
                <div className="afirmaciones">
                  {informe.verificacion.afirmaciones.map((a) => {
                    const m = MARCA[a.veredicto] ?? { mark: '?', label: a.veredicto };
                    return (
                      <article key={a.idx} className="afirmacion">
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                          <span className={`veredicto v-${a.veredicto}`}>
                            {m.mark} {m.label}
                          </span>
                          <span className="meta" style={{ fontSize: 'var(--text-2xs)' }}>
                            Afirmación {a.idx + 1}
                          </span>
                        </div>
                        <p style={{ fontSize: 'var(--text-sm)', lineHeight: 1.65 }}>{a.texto}</p>
                        <div className="citas" style={{ marginTop: 0 }}>
                          {a.chunk_ids.map((id) => (
                            <Button
                              key={id}
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-6 gap-1 px-2 text-[11px]"
                              onClick={() => setCita(id)}
                              title="Abrir el fragmento que respalda esta afirmación"
                            >
                              <BookOpen />
                              {rutaCorta(informe, id)} · {id.slice(0, 8)}
                            </Button>
                          ))}
                          {a.secop_refs.map((ref) => (
                            <span key={ref} className="cita secop" title="Contrato SECOP citado">
                              <Landmark size={11} />
                              {ref}
                            </span>
                          ))}
                          {a.chunk_ids.length === 0 && a.secop_refs.length === 0 && (
                            <span className="meta" style={{ fontSize: 'var(--text-2xs)' }}>
                              Sin citas documentales
                            </span>
                          )}
                        </div>
                        {a.motivo_soporte && (
                          <p className="meta" style={{ fontSize: 'var(--text-xs)' }}>
                            <TriangleAlert
                              size={12}
                              style={{ verticalAlign: '-2px', marginRight: 4 }}
                            />
                            Verificación: {a.motivo_soporte}
                          </p>
                        )}
                      </article>
                    );
                  })}
                </div>
              </div>

              <details>
                <summary>
                  Traza y costo · investigación {informe.id.slice(0, 8)} · ${informe.costo_usd} USD
                </summary>
                <ul className="historial">
                  {informe.traza.map((p) => (
                    <li key={p.paso}>
                      Paso {p.paso}: {p.tool_calls.map((t) => t.name).join(', ') || 'sin herramientas'}
                    </li>
                  ))}
                </ul>
              </details>

              <Alert className="mt-4 border-warn/30 bg-warn/5">
                <TriangleAlert className="text-[var(--warn)]" />
                <AlertDescription>
                  El informe es un apoyo a la investigación. Puede contener interpretaciones
                  generadas por IA; contrasta las citas y la vigencia con las fuentes oficiales.
                </AlertDescription>
              </Alert>
            </section>
          ) : (
            <section className="panel">
              <div className="empty-state" style={{ padding: 'var(--space-10) var(--space-5)' }}>
                <span className="empty-icon">
                  <FileSearch size={18} />
                </span>
                <strong>Sin informe todavía</strong>
                <p>
                  Formula una pregunta jurídica concreta. El agente buscará normas, jurisprudencia y
                  contratos, y verificará las citas antes de responder.
                </p>
              </div>
            </section>
          )}

          <div style={{ marginTop: 'var(--space-6)' }}>
            <Secop />
          </div>
        </div>

        <Fragmento chunkId={cita} />
      </div>
    </div>
  );
}

function rutaCorta(informe: Informe, chunkId: string): string {
  return informe.fuentes.find((f) => f.chunk_id === chunkId)?.ruta ?? 'fragmento';
}
