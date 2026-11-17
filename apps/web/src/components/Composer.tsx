import { useEffect, useRef } from 'react';
import { ArrowUp, PanelRight, Paperclip, Square } from 'lucide-react';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';

// Composer: textarea auto-ajustable + Enviar/Detener. Enter envía,
// Shift+Enter salta línea. Sin estado propio (controlado por el padre).
export default function Composer({
  input,
  sending,
  onInput,
  onSend,
  onStop,
  onToggleSources,
  sourcesOpen,
  sourcesCount,
}: {
  input: string;
  sending: boolean;
  onInput: (v: string) => void;
  onSend: () => void;
  onStop: () => void;
  onToggleSources: () => void;
  sourcesOpen: boolean;
  sourcesCount: number;
}): React.ReactElement {
  const ref = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [input]);

  const cerca = input.length > 7600;

  return (
    <form
      className="composer"
      onSubmit={(e) => {
        e.preventDefault();
        onSend();
      }}
    >
      <div className="composer-row">
        <Textarea
          ref={ref}
          value={input}
          onChange={(e) => onInput(e.target.value)}
          placeholder="Escribe tu pregunta jurídica…"
          rows={1}
          maxLength={8000}
          aria-label="Pregunta jurídica"
          className="min-h-0 flex-1 resize-none border-0 bg-transparent px-0 py-2 shadow-none focus-visible:ring-0"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              onSend();
            }
          }}
        />
        {sending ? (
          <Button
            type="button"
            variant="destructive"
            size="icon"
            className="send-btn stop size-9 rounded-full"
            onClick={onStop}
            title="Detener la generación"
            aria-label="Detener la generación"
          >
            <Square fill="currentColor" />
          </Button>
        ) : (
          <Button
            type="submit"
            size="icon"
            className="send-btn size-9 rounded-full"
            disabled={!input.trim()}
            title="Enviar (Enter)"
            aria-label="Enviar pregunta"
          >
            <ArrowUp />
          </Button>
        )}
      </div>
      <div className="composer-tools">
        <span className="composer-hint">
          <Paperclip size={12} aria-hidden="true" />
          <span>Contexto documental: archivos del proyecto activo</span>
          <span aria-hidden="true">·</span>
          <span>
            <span className="kbd">Enter</span> envía · <span className="kbd">Shift Enter</span>{' '}
            salta línea
          </span>
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className={`composer-count${cerca ? ' cerca' : ''}`}>
            {input.length > 0 ? `${input.length}/8000` : ''}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 gap-1 px-2 text-xs"
            onClick={onToggleSources}
            aria-pressed={sourcesOpen}
            title={sourcesOpen ? 'Ocultar fuentes' : 'Mostrar fuentes'}
          >
            <PanelRight />
            Fuentes{sourcesCount > 0 ? ` (${sourcesCount})` : ''}
          </Button>
        </span>
      </div>
    </form>
  );
}
