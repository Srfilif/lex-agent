import { BookOpen, FileSearch, Quote, Scale, ShieldCheck } from 'lucide-react';

// Bienvenida sin conversación: identidad + capacidades + ejemplos reales.
// Cada ejemplo envía la pregunta directamente (son consultas soportadas).
const EJEMPLOS = [
  {
    icon: Scale,
    texto: '¿Qué dice el artículo 24 de la Ley 80 de 1993 sobre transparencia?',
    etiqueta: 'Normativa',
  },
  {
    icon: BookOpen,
    texto: '¿Qué dice la Constitución sobre el derecho de petición?',
    etiqueta: 'Constitucional',
  },
  {
    icon: FileSearch,
    texto: '¿Qué contratos de software hay? Indica modalidad y valores.',
    etiqueta: 'SECOP',
  },
];

export default function WelcomePane({
  onEjemplo,
}: {
  onEjemplo: (q: string) => void;
}): React.ReactElement {
  return (
    <div className="chat-vacio" style={{ padding: 'var(--space-10) 0 var(--space-6)' }}>
      <span className="eyebrow">
        <Scale size={13} /> Asistente jurídico
      </span>
      <h2 style={{ fontSize: 'var(--text-2xl)', margin: '0.5rem 0' }}>¿Qué necesitas investigar?</h2>
      <p className="meta" style={{ maxWidth: '56ch', margin: '0 auto', fontSize: 'var(--text-sm)' }}>
        Consulta normas, jurisprudencia y contratos públicos. Las respuestas citan el fragmento que
        las respalda; ábrelo para revisar la fuente.
      </p>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
          gap: 'var(--space-3)',
          marginTop: 'var(--space-6)',
          textAlign: 'left',
        }}
      >
        {EJEMPLOS.map(({ icon: Icon, texto, etiqueta }) => (
          <button
            key={texto}
            type="button"
            className="tool-tile"
            style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 'var(--space-2)' }}
            onClick={() => onEjemplo(texto)}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
              <span className="tool-icon" style={{ width: 26, height: 26, flexBasis: 26 }}>
                <Icon size={14} />
              </span>
              <span className="chip" style={{ marginLeft: 'auto' }}>
                {etiqueta}
              </span>
            </span>
            <strong style={{ fontWeight: 550, whiteSpace: 'normal', lineHeight: 1.5 }}>{texto}</strong>
          </button>
        ))}
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          marginTop: 'var(--space-6)',
          flexWrap: 'wrap',
        }}
      >
        <span className="chip chip-ok">
          <ShieldCheck size={11} /> Citas al fragmento
        </span>
        <span className="chip">
          <Quote size={11} /> Fuentes con autoridad
        </span>
        <span className="chip">Vigencia declarada</span>
        <span className="chip">SECOP II</span>
      </div>
    </div>
  );
}
