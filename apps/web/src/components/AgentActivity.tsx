// Actividad agentic: qué herramientas está usando el asistente.
// Solo presenta resultados reales del backend (nombres de tools ejecutadas).
const TOOL_LABEL: Record<string, string> = {
  buscar_normas: 'Buscando normas…',
  consultar_contratos: 'Consultando contratos SECOP…',
};

export default function AgentActivity({ tools }: { tools: string[] }): React.ReactElement | null {
  if (tools.length === 0) return null;
  return (
    <p className="meta tools" role="status">
      ⚙ {tools.map((t) => TOOL_LABEL[t] ?? `Usando ${t}…`).join(' · ')}
    </p>
  );
}
