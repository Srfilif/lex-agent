import type { ChatMessage, Citation } from '../chatApi';
import { Check, Copy, RotateCcw } from 'lucide-react';
import { useState } from 'react';
import AgentActivity from './AgentActivity';
import Markdown from './Markdown';
import { Alert, AlertDescription } from './ui/alert';
import { Button } from './ui/button';

// Una burbuja del hilo (usuario o asistente). Sin estado de negocio: props.
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
  const [copiado, setCopiado] = useState(false);

  function copiar(): void {
    onCopy(m.content);
    setCopiado(true);
    window.setTimeout(() => setCopiado(false), 1600);
  }

  if (m.role === 'user') {
    return (
      <li className="burbuja user">
        <p>{m.content}</p>
      </li>
    );
  }
  return (
    <li className="burbuja assistant">
      <div className="bubble-head">
        <span className="bubble-avatar" aria-hidden="true">
          L
        </span>
        <span className="bubble-name">Lex</span>
        {m.pending && (
          <span className="meta" style={{ fontSize: 'var(--text-2xs)' }}>
            generando…
          </span>
        )}
      </div>
      <div className="bubble-body">
        <AgentActivity tools={m.tools ?? []} />
        {m.pending && !m.content && (
          <div className="thinking" role="status" aria-live="polite">
            <span className="bars" aria-hidden="true">
              <i />
              <i />
              <i />
            </span>
            Analizando el corpus y preparando la respuesta…
          </div>
        )}
        {m.content && <Markdown content={m.content} citations={m.citations} onCita={onCita} />}
        {m.citations.length > 0 && (
          <div className="citas" aria-label="Fuentes citadas">
            {m.citations.map((c) => (
              <Button
                key={c.n}
                type="button"
                variant="outline"
                size="sm"
                className="h-auto max-w-full justify-start gap-1.5 px-2 py-1 text-xs"
                onClick={() => onCita(c)}
                title={`${c.ruta} — ${c.titulo}`}
              >
                <span className="font-semibold text-primary">[{c.n}]</span>
                <span className="truncate">{c.titulo || c.ruta}</span>
              </Button>
            ))}
          </div>
        )}
        {m.error && (
          <Alert variant="destructive" className="my-2 border-destructive/30 bg-destructive/5">
            <AlertDescription>
              <p>{m.error}</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-2"
                onClick={() => onRetry(m.id)}
              >
                Reintentar
              </Button>
            </AlertDescription>
          </Alert>
        )}
        {((!m.pending && !m.error && !!m.content) || m.model || m.costo_usd !== undefined) && (
          <div className="bubble-foot">
            {!m.pending && !m.error && m.content && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 gap-1 px-2 text-xs"
                onClick={copiar}
                aria-label="Copiar respuesta"
              >
                {copiado ? <Check /> : <Copy />}
                {copiado ? ' Copiado' : ' Copiar'}
              </Button>
            )}
            {puedeRegenerar && isLast && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 gap-1 px-2 text-xs"
                onClick={onRegenerar}
                disabled={regenBusy}
                title="Regenera solo la última respuesta del asistente"
              >
                <RotateCcw /> {regenBusy ? ' Regenerando…' : ' Regenerar'}
              </Button>
            )}
            {(m.model || m.costo_usd !== undefined) && (
              <span className="costo">
                {m.model ? `modelo ${m.model}` : ''}
                {m.model && m.costo_usd !== undefined ? ' · ' : ''}
                {m.costo_usd !== undefined ? `$${m.costo_usd} USD` : ''}
              </span>
            )}
          </div>
        )}
      </div>
    </li>
  );
}
