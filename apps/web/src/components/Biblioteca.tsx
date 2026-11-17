import { useEffect, useMemo, useState } from 'react';
import {
  BookOpen,
  ExternalLink,
  FileText,
  Filter,
  Landmark,
  Loader2,
  Quote,
  Search,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import { api, type Cobertura, type CorpusHit, type DocCobertura } from '../api';
import { Button } from './ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { Input } from './ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';

function textoVigencia(v: string): string {
  if (v === 'texto_original') return 'Texto original';
  if (v === 'modificado') return 'Modificado';
  if (v === 'consolidado') return 'Consolidado';
  if (v === 'vigencia_verificada') return 'Vigencia verificada';
  return 'Vigencia no verificada';
}

function vigenciaChip(v: string): string {
  if (v === 'vigencia_verificada') return 'chip chip-ok';
  if (v === 'modificado') return 'chip chip-warn';
  return 'chip';
}

function claveDoc(d: DocCobertura): string {
  return `${d.tipo}|${d.numero ?? ''}|${d.titulo}`;
}

export default function Biblioteca(): React.ReactElement {
  const [cobertura, setCobertura] = useState<Cobertura | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [q, setQ] = useState('');
  const [tipo, setTipo] = useState('');
  const [emisor, setEmisor] = useState('');
  const [vigencia, setVigencia] = useState('');
  const [seleccion, setSeleccion] = useState<DocCobertura | null>(null);
  const [hits, setHits] = useState<CorpusHit[] | null>(null);
  const [buscando, setBuscando] = useState(false);
  const [busquedaError, setBusquedaError] = useState('');
  const [hitAbierto, setHitAbierto] = useState<CorpusHit | null>(null);
  const [metaBuscada, setMetaBuscada] = useState('');

  useEffect(() => {
    let vivo = true;
    api
      .cobertura()
      .then((c) => {
        if (vivo) {
          setCobertura(c);
          setError('');
        }
      })
      .catch((e: Error) => {
        if (vivo) setError(e.message || 'No se pudo cargar el corpus.');
      })
      .finally(() => {
        if (vivo) setCargando(false);
      });
    return () => {
      vivo = false;
    };
  }, []);

  const tipos = useMemo(
    () => [...new Set((cobertura?.docs ?? []).map((d) => d.tipo))].filter(Boolean).sort(),
    [cobertura],
  );
  const emisores = useMemo(
    () => [...new Set((cobertura?.docs ?? []).map((d) => d.emisor))].filter(Boolean).sort(),
    [cobertura],
  );

  const docs = useMemo(() => {
    const term = q.trim().toLowerCase();
    return (cobertura?.docs ?? []).filter((d) => {
      if (tipo && d.tipo !== tipo) return false;
      if (emisor && d.emisor !== emisor) return false;
      if (vigencia && d.vigencia !== vigencia) return false;
      if (!term) return true;
      return (
        d.titulo.toLowerCase().includes(term) ||
        (d.numero ?? '').toLowerCase().includes(term) ||
        d.emisor.toLowerCase().includes(term)
      );
    });
  }, [cobertura, q, tipo, emisor, vigencia]);

  async function buscarFragmentos(texto: string, doc?: DocCobertura | null): Promise<void> {
    const term = texto.trim();
    if (term.length < 2 || buscando) return;
    setBuscando(true);
    setBusquedaError('');
    setHits(null);
    setMetaBuscada(term);
    try {
      const r = await api.search(term, {
        topK: 10,
        tipo: doc?.tipo ?? (tipo || undefined),
        emisor: doc?.emisor ?? (emisor || undefined),
      });
      setHits(r.hits);
    } catch (e) {
      setBusquedaError((e as Error).message || 'La búsqueda no respondió.');
    } finally {
      setBuscando(false);
    }
  }

  function onSubmit(e: React.FormEvent): void {
    e.preventDefault();
    if (q.trim().length >= 2) {
      void buscarFragmentos(q, null);
    }
  }

  function limpiarFiltros(): void {
    setTipo('');
    setEmisor('');
    setVigencia('');
  }

  const filtrosActivos = Boolean(tipo || emisor || vigencia);
  const listaHits = hits ?? [];

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <span className="eyebrow">
            <Landmark size={13} /> Corpus documental
          </span>
          <h1 className="page-title">Biblioteca jurídica</h1>
          <p className="page-sub">
            Explora los documentos normativos y jurisprudenciales indexados. La búsqueda combina
            coincidencia textual y semántica sobre fragmentos reales del corpus.
          </p>
        </div>
        <div className="page-actions">
          {cobertura && (
            <span className="chip">
              {cobertura.documentos} documentos · {cobertura.fragmentos} fragmentos
            </span>
          )}
        </div>
      </div>

      <form className="bib-search" onSubmit={onSubmit}>
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por título, número de norma o entidad emisora…"
          aria-label="Buscar en la biblioteca"
          className="h-11"
        />
        <Button type="submit" disabled={q.trim().length < 2 || buscando}>
          {buscando ? <Loader2 className="animate-spin" /> : <Search />}
          Buscar fragmentos
        </Button>
      </form>

      <div className="bib-filters" aria-label="Filtros de la biblioteca">
        <SlidersHorizontal size={14} style={{ color: 'var(--muted)' }} />
        <Select value={tipo || 'all'} onValueChange={(value) => setTipo(value === 'all' ? '' : value)}>
          <SelectTrigger aria-label="Tipo de norma">
            <SelectValue placeholder="Todos los tipos" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los tipos</SelectItem>
            {tipos.map((t) => (
              <SelectItem key={t} value={t}>
                {t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={emisor || 'all'}
          onValueChange={(value) => setEmisor(value === 'all' ? '' : value)}
        >
          <SelectTrigger aria-label="Entidad emisora">
            <SelectValue placeholder="Todas las entidades" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las entidades</SelectItem>
            {emisores.map((t) => (
              <SelectItem key={t} value={t}>
                {t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={vigencia || 'all'}
          onValueChange={(value) => setVigencia(value === 'all' ? '' : value)}
        >
          <SelectTrigger aria-label="Vigencia">
            <SelectValue placeholder="Cualquier vigencia" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Cualquier vigencia</SelectItem>
            <SelectItem value="vigencia_verificada">Vigencia verificada</SelectItem>
            <SelectItem value="texto_original">Texto original</SelectItem>
            <SelectItem value="modificado">Modificado</SelectItem>
            <SelectItem value="consolidado">Consolidado</SelectItem>
          </SelectContent>
        </Select>
        {filtrosActivos && (
          <Button type="button" variant="ghost" size="sm" className="h-7" onClick={limpiarFiltros}>
            <X /> Limpiar filtros
          </Button>
        )}
        <span className="meta" style={{ marginLeft: 'auto', fontSize: 'var(--text-xs)' }}>
          {docs.length} documento(s)
        </span>
      </div>

      {hits !== null || buscando || busquedaError ? (
        <section className="panel" style={{ marginBottom: 'var(--space-5)' }}>
          <div className="panel-head">
            <h2>
              <Quote size={14} style={{ verticalAlign: '-2px', marginRight: 5 }} />
              Fragmentos para «{metaBuscada}» {listaHits.length > 0 ? `(${listaHits.length})` : ''}
            </h2>
            <Button type="button" variant="ghost" size="sm" onClick={() => setHits(null)}>
              Volver a documentos
            </Button>
          </div>
          {buscando && (
            <div className="empty-state">
              <Loader2 size={20} className="spin" />
              <p>Recuperando fragmentos del corpus…</p>
            </div>
          )}
          {busquedaError && (
            <div className="empty-state">
              <strong>La búsqueda falló</strong>
              <p className="error">{busquedaError}</p>
              <Button type="button" onClick={() => void buscarFragmentos(metaBuscada, null)}>
                Reintentar
              </Button>
            </div>
          )}
          {!buscando && !busquedaError && listaHits.length === 0 && (
            <div className="empty-state">
              <span className="empty-icon">
                <Search size={18} />
              </span>
              <strong>Sin fragmentos recuperados</strong>
              <p>
                Prueba con otro término o con el identificador de la norma (por ejemplo,
                «artículo 24 ley 80»).
              </p>
            </div>
          )}
          {!buscando && listaHits.length > 0 && (
            <ul className="hit-list" style={{ padding: 'var(--space-4)' }}>
              {listaHits.map((h) => (
                <li key={h.chunk_id} className="hit-card">
                  <div className="hit-card-head">
                    <strong>{h.doc.titulo}</strong>
                    <span className={vigenciaChip(h.doc.vigencia)}>
                      {textoVigencia(h.doc.vigencia)}
                    </span>
                  </div>
                  <p className="meta" style={{ fontSize: 'var(--text-xs)' }}>
                    {h.ruta} · {h.doc.tipo}
                    {h.doc.numero ? ` ${h.doc.numero}` : ''} · {h.doc.autoridad}
                  </p>
                  <p className="hit-text" style={{ marginTop: 'var(--space-2)' }}>
                    {h.texto}
                  </p>
                  <div className="hit-foot">
                    <span className="meta" style={{ fontSize: 'var(--text-2xs)' }}>
                      {h.metodo === 'estructurado' ? 'Coincidencia estructurada' : 'Búsqueda híbrida'} ·
                      relevancia {h.score.toFixed(3)}
                    </span>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      <button type="button" className="mini" onClick={() => setHitAbierto(h)}>
                        Ver fragmento completo
                      </button>
                      {h.doc.url && (
                        <a
                          className="boton-enlace"
                          style={{ padding: '0.2rem 0.5rem', fontSize: 'var(--text-xs)' }}
                          href={h.doc.url}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <ExternalLink size={12} /> Fuente oficial
                        </a>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      <div className="bib-layout">
        <section className="panel" aria-label="Documentos del corpus">
          {cargando && (
            <div style={{ padding: 'var(--space-5)' }}>
              {[0, 1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="skeleton"
                  style={{ height: 34, margin: '0.65rem 0', width: `${94 - i * 7}%` }}
                />
              ))}
            </div>
          )}
          {!cargando && error && (
            <div className="empty-state">
              <span className="empty-icon">
                <Filter size={18} />
              </span>
              <strong>No se pudo cargar la biblioteca</strong>
              <p className="error">{error}</p>
            </div>
          )}
          {!cargando && !error && docs.length === 0 && (
            <div className="empty-state">
              <span className="empty-icon">
                <BookOpen size={18} />
              </span>
              <strong>Sin documentos que coincidan</strong>
              <p>Ajusta la búsqueda o los filtros para ver otras fuentes del corpus.</p>
              {(filtrosActivos || q) && (
                <button
                  type="button"
                  onClick={() => {
                    setQ('');
                    limpiarFiltros();
                  }}
                >
                  Limpiar búsqueda
                </button>
              )}
            </div>
          )}
          {!cargando && !error && docs.length > 0 && (
            <ul className="doc-list">
              {docs.map((d) => (
                <li key={claveDoc(d)}>
                  <button
                    type="button"
                    className={`doc-row${seleccion && claveDoc(seleccion) === claveDoc(d) ? ' activo' : ''}`}
                    onClick={() => {
                      setSeleccion(d);
                      setHitAbierto(null);
                    }}
                  >
                    <span className="row-icon">
                      <FileText size={15} />
                    </span>
                    <span className="doc-row-main">
                      <strong>{d.titulo}</strong>
                      <span>
                        {d.tipo}
                        {d.numero ? ` ${d.numero}` : ''} · {d.emisor}
                      </span>
                    </span>
                    <span className="doc-row-side">
                      <span className={vigenciaChip(d.vigencia)}>{textoVigencia(d.vigencia)}</span>
                      <span className="meta" style={{ fontSize: 'var(--text-2xs)' }}>
                        {d.fragmentos} fragmento(s)
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <aside className="panel" aria-label="Detalle del documento">
          {seleccion ? (
            <div style={{ padding: 'var(--space-5)' }}>
              <div className="fragmento-type" style={{ marginBottom: 'var(--space-2)' }}>
                <span className="chip chip-accent">{seleccion.tipo}</span>
                {seleccion.numero && <span className="chip">{seleccion.numero}</span>}
                <span className={vigenciaChip(seleccion.vigencia)}>
                  {textoVigencia(seleccion.vigencia)}
                </span>
              </div>
              <h2
                style={{
                  fontSize: 'var(--text-lg)',
                  fontFamily: 'var(--font-serif)',
                  fontWeight: 600,
                  lineHeight: 1.35,
                }}
              >
                {seleccion.titulo}
              </h2>
              <dl className="meta-grid" style={{ marginTop: 'var(--space-4)' }}>
                <div>
                  <dt>Entidad emisora</dt>
                  <dd>{seleccion.emisor}</dd>
                </div>
                <div>
                  <dt>Jurisdicción</dt>
                  <dd>{seleccion.jurisdiccion ?? 'No declarada'}</dd>
                </div>
                <div>
                  <dt>Fragmentos indexados</dt>
                  <dd>{seleccion.fragmentos}</dd>
                </div>
                <div>
                  <dt>Fecha de consulta</dt>
                  <dd>{seleccion.fecha_consulta ?? 'No registrada'}</dd>
                </div>
              </dl>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 'var(--space-4)' }}>
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  disabled={buscando}
                  onClick={() =>
                    void buscarFragmentos(
                      seleccion.numero
                        ? `${seleccion.tipo} ${seleccion.numero}`
                        : seleccion.titulo,
                      seleccion,
                    )
                  }
                >
                  {buscando && <Loader2 className="animate-spin" />}
                  {buscando ? 'Buscando…' : 'Ver fragmentos'}
                </Button>
              </div>
              <p className="meta" style={{ fontSize: 'var(--text-2xs)', marginTop: 'var(--space-4)' }}>
                La biblioteca expone los metadatos y fragmentos indexados. La vigencia y el texto
                consolidado deben contrastarse con la fuente oficial.
              </p>
            </div>
          ) : (
            <div className="empty-state">
              <span className="empty-icon">
                <BookOpen size={18} />
              </span>
              <strong>Selecciona un documento</strong>
              <p>Consulta sus metadatos y recupera los fragmentos indexados de la fuente.</p>
            </div>
          )}
        </aside>
      </div>

      <Dialog open={hitAbierto !== null} onOpenChange={(open) => !open && setHitAbierto(null)}>
        <DialogContent className="max-h-[82vh] overflow-y-auto sm:max-w-3xl">
          {hitAbierto && (
            <>
              <DialogHeader className="pr-8">
                <DialogTitle className="font-heading text-xl">{hitAbierto.doc.titulo}</DialogTitle>
                <DialogDescription>
                  {hitAbierto.ruta} · {hitAbierto.doc.autoridad}
                </DialogDescription>
              </DialogHeader>
              <div className="fragmento-type">
                <span className={vigenciaChip(hitAbierto.doc.vigencia)}>
                  {textoVigencia(hitAbierto.doc.vigencia)}
                </span>
                <span className="chip">relevancia {hitAbierto.score.toFixed(3)}</span>
              </div>
              <blockquote className="rounded-r-lg border-l-2 border-primary bg-muted/50 px-5 py-4 text-sm leading-7 whitespace-pre-wrap">
                {hitAbierto.texto}
              </blockquote>
              <div className="space-y-2">
                <h3 className="text-[0.6875rem] font-semibold tracking-[0.06em] text-muted-foreground uppercase">
                  Contexto recuperado
                </h3>
                <p className="text-sm whitespace-pre-wrap text-muted-foreground">
                  {hitAbierto.texto_contexto}
                </p>
              </div>
              {hitAbierto.doc.url && (
                <Button asChild variant="outline" className="w-fit">
                  <a href={hitAbierto.doc.url} target="_blank" rel="noreferrer">
                    <ExternalLink /> Abrir fuente oficial
                  </a>
                </Button>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
