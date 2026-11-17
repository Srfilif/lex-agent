import { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  BookOpen,
  Building2,
  FileSearch,
  FileText,
  FolderOpen,
  Landmark,
  MessageSquare,
  PenLine,
  Scale,
  ShieldCheck,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import { AuthHttpError, mensajeError } from '../auth';
import { api, type Cobertura } from '../api';
import {
  listAllFiles,
  listConversations,
  listProjects,
  type Conversation,
  type Project,
  type StoredFile,
} from '../chatApi';
import { fetchEntitlements, fetchUso, type Entitlements, type Me, type Uso } from '../cuenta';
import { fechaLegible } from '../shared/formato';
import type { Vista } from './AppShell';
import { Alert, AlertDescription } from './ui/alert';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Progress } from './ui/progress';

const SUGERENCIAS = [
  '¿Qué dice el artículo 24 de la Ley 80 de 1993 sobre transparencia?',
  '¿Qué dice la Constitución sobre el derecho de petición?',
  '¿Qué contratos de software hay? Indica modalidad y valores.',
];

function saludo(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Buenos días';
  if (h < 19) return 'Buenas tardes';
  return 'Buenas noches';
}

function hace(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const ms = Date.now() - d.getTime();
  const min = Math.round(ms / 60000);
  if (min < 1) return 'ahora';
  if (min < 60) return `hace ${min} min`;
  const hs = Math.round(min / 60);
  if (hs < 24) return `hace ${hs} h`;
  const dias = Math.round(hs / 24);
  if (dias < 7) return `hace ${dias} d`;
  return fechaLegible(iso);
}

function describe(e: unknown): string {
  if (e instanceof AuthHttpError) return mensajeError(e.status, e.message);
  if (e instanceof TypeError) return 'Sin conexión con la API.';
  return (e as Error).message;
}

interface Datos {
  conversaciones: Conversation[];
  proyectos: Project[];
  archivos: StoredFile[];
  uso: Uso | null;
  ent: Entitlements | null;
  cobertura: Cobertura | null;
}

export default function Dashboard({
  me,
  onAsk,
  onNav,
  onOpenChat,
}: {
  me: Me | null;
  onAsk: (pregunta: string) => void;
  onNav: (v: Vista) => void;
  onOpenChat: (id: string) => void;
}): React.ReactElement {
  const [datos, setDatos] = useState<Datos | null>(null);
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(true);
  const [pregunta, setPregunta] = useState('');
  const [reintento, setReintento] = useState(0);

  useEffect(() => {
    let vivo = true;
    setCargando(true);
    setError('');
    void Promise.allSettled([
      listConversations(false),
      listProjects(),
      listAllFiles(),
      fetchUso(),
      fetchEntitlements(),
      api.cobertura(),
    ]).then(([conv, proj, files, uso, ent, cob]) => {
      if (!vivo) return;
      const fallos: string[] = [];
      if (conv.status === 'rejected') fallos.push(describe(conv.reason));
      if (proj.status === 'rejected') fallos.push(describe(proj.reason));
      setDatos({
        conversaciones: conv.status === 'fulfilled' ? conv.value : [],
        proyectos: proj.status === 'fulfilled' ? proj.value : [],
        archivos: files.status === 'fulfilled' ? files.value.files : [],
        uso: uso.status === 'fulfilled' ? uso.value : null,
        ent: ent.status === 'fulfilled' ? ent.value : null,
        cobertura: cob.status === 'fulfilled' ? cob.value : null,
      });
      const unico = [...new Set(fallos)].filter(Boolean);
      if (unico.length > 0) setError(unico[0]);
      setCargando(false);
    });
    return () => {
      vivo = false;
    };
  }, [reintento]);

  const actividades = useMemo(() => {
    if (!datos) return [];
    const items = [
      ...datos.conversaciones.slice(0, 8).map((c) => ({
        id: `c-${c.id}`,
        tipo: 'consulta' as const,
        titulo: c.title || 'Consulta sin título',
        fecha: c.updated_at,
        accion: () => onOpenChat(c.id),
      })),
      ...datos.archivos.slice(0, 6).map((f) => ({
        id: `f-${f.id}`,
        tipo: 'archivo' as const,
        titulo: f.filename,
        fecha: f.created_at,
        accion: () => onNav('storage'),
      })),
    ];
    return items
      .filter((i) => !Number.isNaN(new Date(i.fecha).getTime()))
      .sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime())
      .slice(0, 6);
  }, [datos, onOpenChat, onNav]);

  const recientes = datos?.conversaciones.slice(0, 5) ?? [];
  const documentos = datos?.archivos.slice(0, 4) ?? [];
  const corpus = datos?.cobertura ?? null;
  const vigenciaVerificada = (corpus?.docs ?? []).some((d) => d.vigencia === 'vigencia_verificada');
  const usoInv = datos?.uso?.investigaciones;
  const usoTok = datos?.uso?.tokens;
  const pctInv = usoInv && usoInv.limit > 0 ? Math.min(100, (usoInv.used / usoInv.limit) * 100) : 0;
  const pctTok = usoTok && usoTok.limit > 0 ? Math.min(100, (usoTok.used / usoTok.limit) * 100) : 0;

  function enviar(e: React.FormEvent): void {
    e.preventDefault();
    const q = pregunta.trim();
    if (q) onAsk(q);
  }

  return (
    <div className="page">
      <section className="dash-hero">
        <span className="eyebrow">
          <Scale size={13} /> Investigación jurídica asistida
        </span>
        <h1 className="dash-greeting">
          {saludo()}
          {me?.display_name ? `, ${me.display_name.split(' ')[0]}` : ''}.
        </h1>
        <p className="dash-sub">
          Consulta normativa y jurisprudencia colombiana con respuestas fundamentadas en fuentes
          documentales. Cada afirmación relevante queda enlazada al fragmento que la respalda.
        </p>
        <form className="ask-bar" onSubmit={enviar}>
          <Sparkles size={17} aria-hidden="true" />
          <Input
            value={pregunta}
            onChange={(e) => setPregunta(e.target.value)}
            placeholder="Pregunta sobre una norma, una sentencia o un documento…"
            aria-label="Pregunta jurídica"
            maxLength={8000}
            className="h-10 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
          />
          <Button type="submit" className="h-9" disabled={!pregunta.trim()}>
            Consultar
            <ArrowRight />
          </Button>
        </form>
        <div className="ejemplos" aria-label="Consultas sugeridas">
          {SUGERENCIAS.map((q) => (
            <button key={q} type="button" className="ejemplo" onClick={() => onAsk(q)}>
              {q}
            </button>
          ))}
        </div>
      </section>

      {error && (
        <Alert variant="destructive" className="mb-5 border-destructive/30 bg-destructive/5">
          <ShieldCheck />
          <AlertDescription>
            No se pudieron cargar todos los datos: {error}{' '}
            <Button
              type="button"
              variant="link"
              size="sm"
              className="h-auto p-0 text-xs"
              onClick={() => setReintento((n) => n + 1)}
            >
              Reintentar
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <div className="quick-tools" aria-label="Herramientas jurídicas">
        <button type="button" className="tool-tile" onClick={() => onNav('chat')}>
          <span className="tool-icon">
            <MessageSquare size={17} />
          </span>
          <span>
            <strong>Asistente jurídico</strong>
            <span>Conversación con citas al fragmento</span>
          </span>
        </button>
        <button type="button" className="tool-tile" onClick={() => onNav('investigar')}>
          <span className="tool-icon">
            <FileSearch size={17} />
          </span>
          <span>
            <strong>Investigar</strong>
            <span>Informe estructurado y verificado</span>
          </span>
        </button>
        <button type="button" className="tool-tile" onClick={() => onNav('biblioteca')}>
          <span className="tool-icon">
            <BookOpen size={17} />
          </span>
          <span>
            <strong>Biblioteca</strong>
            <span>Explorar el corpus normativo</span>
          </span>
        </button>
        <button type="button" className="tool-tile" onClick={() => onNav('storage')}>
          <span className="tool-icon">
            <FolderOpen size={17} />
          </span>
          <span>
            <strong>Documentos</strong>
            <span>Archivos de tus proyectos</span>
          </span>
        </button>
      </div>

      <div className="dash-grid" style={{ marginTop: 'var(--space-5)' }}>
        <div className="dash-stack">
          <section className="panel">
            <div className="panel-head">
              <h2>Consultas recientes</h2>
              <Button type="button" variant="ghost" size="sm" onClick={() => onNav('chat')}>
                Ver asistente
              </Button>
            </div>
            {cargando ? (
              <div style={{ padding: 'var(--space-4) var(--space-5)' }}>
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="skeleton"
                    style={{ height: 18, margin: '0.85rem 0', width: `${88 - i * 12}%` }}
                  />
                ))}
              </div>
            ) : recientes.length === 0 ? (
              <div className="empty-state">
                <span className="empty-icon">
                  <MessageSquare size={18} />
                </span>
                <strong>Aún no hay consultas</strong>
                <p>Inicia una conversación para ver aquí tu historial reciente.</p>
                <Button type="button" onClick={() => onNav('chat')}>
                  Abrir asistente
                </Button>
              </div>
            ) : (
              <ul className="row-list">
                {recientes.map((c) => (
                  <li key={c.id} className="row-item">
                    <span className="row-icon">
                      <MessageSquare size={15} />
                    </span>
                    <button
                      type="button"
                      className="row-main"
                      onClick={() => onOpenChat(c.id)}
                      title={c.title}
                    >
                      <strong>{c.title || 'Consulta sin título'}</strong>
                      <span>
                        {(c.topics ?? []).length > 0
                          ? (c.topics ?? []).join(' · ')
                          : 'Conversación jurídica'}
                      </span>
                    </button>
                    <span className="row-time">{hace(c.updated_at)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="panel">
            <div className="panel-head">
              <h2>Proyectos de investigación</h2>
              <Button type="button" variant="ghost" size="sm" onClick={() => onNav('chat')}>
                Gestionar
              </Button>
            </div>
            {datos && datos.proyectos.length > 0 ? (
              <ul className="row-list">
                {datos.proyectos.slice(0, 4).map((p) => (
                  <li key={p.id} className="row-item">
                    <span className="row-icon">
                      <FolderOpen size={15} />
                    </span>
                    <span className="row-main">
                      <strong>{p.name}</strong>
                      <span>{p.instructions || 'Sin instrucciones particulares'}</span>
                    </span>
                    <span className="chip">{p.conversation_count ?? 0} chats</span>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="empty-state">
                <span className="empty-icon">
                  <FolderOpen size={18} />
                </span>
                <strong>Organiza tus investigaciones</strong>
                <p>
                  Crea proyectos en el asistente para agrupar conversaciones, instrucciones y
                  documentos de un mismo caso.
                </p>
              </div>
            )}
          </section>

          <section className="panel">
            <div className="panel-head">
              <h2>Actividad reciente</h2>
            </div>
            {cargando ? (
              <div style={{ padding: 'var(--space-4) var(--space-5)' }}>
                <div className="skeleton" style={{ height: 14, width: '70%', margin: '0.7rem 0' }} />
                <div className="skeleton" style={{ height: 14, width: '55%', margin: '0.7rem 0' }} />
              </div>
            ) : actividades.length === 0 ? (
              <div className="empty-state">
                <span className="empty-icon">
                  <TrendingUp size={18} />
                </span>
                <strong>Sin actividad todavía</strong>
                <p>Cuando consultes o cargues documentos, aparecerán en este registro.</p>
              </div>
            ) : (
              <ul className="row-list">
                {actividades.map((a) => (
                  <li key={a.id} className="row-item">
                    <span className="row-icon">
                      {a.tipo === 'consulta' ? <MessageSquare size={15} /> : <FileText size={15} />}
                    </span>
                    <button type="button" className="row-main" onClick={a.accion}>
                      <strong>{a.titulo}</strong>
                      <span>{a.tipo === 'consulta' ? 'Consulta en el asistente' : 'Documento cargado'}</span>
                    </button>
                    <span className="row-time">{hace(a.fecha)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <div className="dash-stack">
          <section className="panel panel-pad">
            <div className="section-head">
              <h2 className="section-title">Cobertura del corpus</h2>
              <span className="chip chip-gold">
                <Landmark size={11} /> Fuentes
              </span>
            </div>
            {cargando ? (
              <div className="skeleton" style={{ height: 58 }} />
            ) : corpus ? (
              <>
                <div className="stat-grid">
                  <div className="stat">
                    <div className="stat-value">{corpus.documentos}</div>
                    <div className="stat-label">Documentos</div>
                  </div>
                  <div className="stat">
                    <div className="stat-value">{corpus.fragmentos}</div>
                    <div className="stat-label">Fragmentos</div>
                  </div>
                </div>
                <p className="meta" style={{ marginTop: 'var(--space-3)' }}>
                  {vigenciaVerificada
                    ? 'Vigencia parcialmente verificada en el corpus.'
                    : 'Vigencia normativa no verificada.'}{' '}
                  Contrasta siempre con la fuente oficial.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  className="mt-3 w-full"
                  onClick={() => onNav('biblioteca')}
                >
                  <BookOpen /> Explorar biblioteca
                </Button>
              </>
            ) : (
              <p className="meta">
                La API no respondió con la cobertura del corpus. Verifica la conexión con el
                servicio.
              </p>
            )}
          </section>

          <section className="panel panel-pad">
            <div className="section-head">
              <h2 className="section-title">Uso del plan</h2>
              <span className="chip">{datos?.ent?.plan ?? datos?.uso?.plan ?? '—'}</span>
            </div>
            {datos?.uso ? (
              <>
                <div className="usage-row">
                  <div className="usage-label">
                    <span>Investigaciones</span>
                    <strong>
                      {usoInv?.used ?? 0} / {usoInv?.limit ?? 0}
                    </strong>
                  </div>
                  <Progress
                    value={pctInv}
                    className={
                      pctInv > 90
                        ? '[&>[data-slot=progress-indicator]]:bg-[var(--bad)]'
                        : pctInv > 70
                          ? '[&>[data-slot=progress-indicator]]:bg-[var(--warn)]'
                          : undefined
                    }
                  />
                </div>
                <div className="usage-row">
                  <div className="usage-label">
                    <span>Tokens</span>
                    <strong>
                      {(usoTok?.used ?? 0).toLocaleString('es-CO')} /{' '}
                      {(usoTok?.limit ?? 0).toLocaleString('es-CO')}
                    </strong>
                  </div>
                  <Progress
                    value={pctTok}
                    className={
                      pctTok > 90
                        ? '[&>[data-slot=progress-indicator]]:bg-[var(--bad)]'
                        : pctTok > 70
                          ? '[&>[data-slot=progress-indicator]]:bg-[var(--warn)]'
                          : undefined
                    }
                  />
                </div>
                <p className="meta" style={{ marginTop: 'var(--space-3)' }}>
                  {datos.uso.reset_at
                    ? `El periodo se reinicia el ${fechaLegible(datos.uso.reset_at)}.`
                    : 'Periodo de uso activo.'}
                </p>
                <Button
                  type="button"
                  variant="outline"
                  className="mt-3 w-full"
                  onClick={() => onNav('cuenta')}
                >
                  <PenLine /> Ver plan y facturación
                </Button>
              </>
            ) : (
              <p className="meta">No se pudo consultar el uso del plan.</p>
            )}
          </section>

          <section className="panel">
            <div className="panel-head">
              <h2>Documentos recientes</h2>
              <Button type="button" variant="ghost" size="sm" onClick={() => onNav('storage')}>
                Ver todos
              </Button>
            </div>
            {documentos.length === 0 ? (
              <div className="empty-state" style={{ padding: 'var(--space-5)' }}>
                <span className="empty-icon">
                  <FileText size={17} />
                </span>
                <strong>Sin documentos</strong>
                <p>Sube archivos desde un proyecto del asistente para analizarlos con contexto.</p>
              </div>
            ) : (
              <ul className="row-list">
                {documentos.map((f) => (
                  <li key={f.id} className="row-item">
                    <span className="row-icon">
                      <FileText size={15} />
                    </span>
                    <button type="button" className="row-main" onClick={() => onNav('storage')}>
                      <strong title={f.filename}>{f.filename}</strong>
                      <span>{f.project_name}</span>
                    </button>
                    <span className="row-time">{fechaLegible(f.created_at)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="panel panel-pad">
            <div className="section-head">
              <h2 className="section-title">Autoridad y transparencia</h2>
              <ShieldCheck size={16} style={{ color: 'var(--ok)' }} />
            </div>
            <p className="meta" style={{ fontSize: 'var(--text-xs)', lineHeight: 1.6 }}>
              Las respuestas distinguen entre contenido respaldado por fuentes y análisis generado
              por IA. Cuando la evidencia recuperada es insuficiente, la plataforma lo advierte.
            </p>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 'var(--space-3)' }}>
              <span className="chip chip-ok">Citas al fragmento</span>
              <span className="chip">Vigencia declarada</span>
              <span className="chip">SECOP</span>
            </div>
          </section>

          <section className="panel panel-pad">
            <div className="section-head">
              <h2 className="section-title">Resumen</h2>
              <Building2 size={15} style={{ color: 'var(--muted)' }} />
            </div>
            <div className="stat-grid">
              <div className="stat">
                <div className="stat-value">{datos?.conversaciones.length ?? '—'}</div>
                <div className="stat-label">Chats recientes</div>
              </div>
              <div className="stat">
                <div className="stat-value">{datos?.proyectos.length ?? '—'}</div>
                <div className="stat-label">Proyectos</div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
