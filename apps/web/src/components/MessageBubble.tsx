import type { ChatMessage, Citation } from '../chatApi';
import AgentActivity from './AgentActivity';
import Markdown from './Markdown';

// Una burbuja del hilo (usuario o asistente). Sin estado: todo vía props.
export default function MessageBubble({
  m,
  isLast,
  puedeRegenerar,
  regenBusy,
  onCita,
  onCopy,
  onRetry,
  onRegenerar,
}: {
  m: ChatMessage;
  isLast: boolean;
  puedeRegenerar: boolean;
  regenBusy: boolean;
  onCita: (c: Citation) => void;
  onCopy: (text: string) => void;
  onRetry: (id: string) => void;
  onRegenerar: () => void;
}): React.ReactElement {
  if (m.role === 'user') {
    return (
      <li className="burbuja user">
        <p>{m.content}</p>
      </li>
    );
  }
  return (
    <li className="burbuja assistant">
      <AgentActivity tools={m.tools ?? []} />
      {m.pending && !m.content && <p className="meta">Lex está pensando…</p>}
      {m.content && <Markdown content={m.content} citations={m.citations} onCita={onCita} />}
      {m.citations.length > 0 && (
        <div className="citas">
          {m.citations.map((c) => (
            <button key={c.n} type="button" className="cita" onClick={() => onCita(c)}>
              [{c.n}] {c.ruta.slice(0, 60)}
            </button>
          ))}
        </div>
      )}
      {(m.model || m.costo_usd !== undefined) && (
        <p className="meta costo">
          {m.model ? `modelo ${m.model}` : ''}
          {m.model && m.costo_usd !== undefined ? ' · ' : ''}
          {m.costo_usd !== undefined ? `$${m.costo_usd} USD` : ''}
        </p>
      )}
      {m.error && (
        <div className="msg-error">
          <p className="error">{m.error}</p>
          <button type="button" onClick={() => onRetry(m.id)}>
            Reintentar
          </button>
        </div>
      )}
      {!m.pending && !m.error && m.content && (
        <button type="button" className="mini" onClick={() => onCopy(m.content)}>
          Copiar respuesta
        </button>
      )}
      {puedeRegenerar && isLast && (
        <button
          type="button"
          className="mini"
          onClick={onRegenerar}
          disabled={regenBusy}
          title="Regenera solo la última respuesta del asistente"
        >
          {regenBusy ? 'Regenerando…' : '↻ Regenerar respuesta'}
        </button>
      )}
    </li>
  );
}
