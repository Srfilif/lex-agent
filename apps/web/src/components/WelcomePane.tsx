// Bienvenida sin conversación: identidad + capacidades + ejemplos reales.
// Cada ejemplo envía la pregunta directamente (son consultas soportadas).
const EJEMPLOS = [
  '¿Qué dice el artículo 24 de la Ley 80 de 1993 sobre transparencia?',
  '¿Qué contratos de software hay? Indica modalidad y valores.',
  '¿Qué dice la Constitución sobre el derecho de petición?',
];

export default function WelcomePane({
  onEjemplo,
}: {
  onEjemplo: (q: string) => void;
}): React.ReactElement {
  return (
    <div className="chat-vacio">
      <h2>¿En qué te ayudo hoy?</h2>
      <p className="meta">
        Pregunta sobre normas, jurisprudencia o contratos SECOP. Cito fuentes con [n] y
        puedes abrir cada fragmento.
      </p>
      <div className="ejemplos">
        {EJEMPLOS.map((q) => (
          <button key={q} type="button" className="ejemplo" onClick={() => onEjemplo(q)}>
            {q}
          </button>
        ))}
      </div>
    </div>
  );
}
