// Exportador de conversaciones a Markdown (B9). Puro y unit-testeable.
import { Citation, MessageProps } from './conversation';

export interface ExportInput {
  title: string;
  projectName: string | null;
  exportedAt: Date;
  messages: MessageProps[];
}

function citaLinea(c: Citation): string {
  const ref = c.chunk_id ? `chunk ${c.chunk_id.slice(0, 8)}` : `SECOP ${c.secop_ref ?? '?'}`;
  return `- [${c.n}] ${c.ruta} — ${c.titulo} (${ref})`;
}

export function buildConversationMarkdown(input: ExportInput): string {
  const lines: string[] = [
    `# ${input.title || 'Conversación'}`,
    '',
    `Exportado: ${input.exportedAt.toISOString()}`,
  ];
  if (input.projectName) lines.push(`Proyecto: ${input.projectName}`);
  lines.push('');
  for (const m of input.messages) {
    lines.push(m.role === 'user' ? '## Usuario' : '## Lex');
    lines.push('');
    lines.push(m.content || '_(sin contenido)_');
    lines.push('');
    if (m.role === 'assistant' && m.citations.length) {
      lines.push('**Fuentes:**');
      lines.push('');
      for (const c of m.citations) lines.push(citaLinea(c));
      lines.push('');
    }
    if (m.role === 'assistant' && (m.model || m.costUsd !== null)) {
      const bits: string[] = [];
      if (m.model) bits.push(`modelo ${m.model}`);
      if (m.costUsd !== null && m.costUsd !== undefined) bits.push(`$${m.costUsd} USD`);
      lines.push(`_${bits.join(' · ')}_`);
      lines.push('');
    }
  }
  lines.push('---');
  lines.push('_Generado por Kelsyx. Verifique las fuentes antes de actuar._');
  lines.push('');
  return lines.join('\n');
}
