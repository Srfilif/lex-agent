import { useEffect, useRef } from 'react';

// Composer: textarea auto-ajustable + Enviar/Detener. Enter envía,
// Shift+Enter salta línea. Sin estado propio (controlado por el padre).
export default function Composer({
  input,
  sending,
  onInput,
  onSend,
  onStop,
}: {
  input: string;
  sending: boolean;
  onInput: (v: string) => void;
  onSend: () => void;
  onStop: () => void;
}): React.ReactElement {
  const ref = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [input]);

  return (
    <form
      className="composer"
      onSubmit={(e) => {
        e.preventDefault();
        onSend();
      }}
    >
      <textarea
        ref={ref}
        value={input}
        onChange={(e) => onInput(e.target.value)}
        placeholder="Escribe tu pregunta jurídica… (Enter para enviar)"
        rows={2}
        maxLength={8000}
        aria-label="Pregunta jurídica"
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            onSend();
          }
        }}
      />
      {sending ? (
        <button type="button" onClick={onStop} title="Detener la generación">
          Detener
        </button>
      ) : (
        <button type="submit" disabled={!input.trim()}>
          Enviar
        </button>
      )}
    </form>
  );
}
