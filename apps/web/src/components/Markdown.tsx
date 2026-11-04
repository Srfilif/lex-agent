import type { ReactNode } from 'react';
import type { Citation } from '../chatApi';

// Mini-render Markdown propio (sin dependencias): headings, listas,
// negrita, cursiva, código, enlaces y párrafos. El HTML se escapa siempre.
// Las citas [n] se convierten en botones que abren el visor Fragmento.

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

interface InlinePart {
  kind: 'text' | 'cita';
  text: string;
  num: number;
}

function splitCitas(s: string): InlinePart[] {
  const out: InlinePart[] = [];
  const re = /\[(\d{1,2})\]/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s)) !== null) {
    if (m.index > last) out.push({ kind: 'text', text: s.slice(last, m.index), num: 0 });
    out.push({ kind: 'cita', text: m[0], num: Number(m[1]) });
    last = m.index + m[0].length;
  }
  if (last < s.length) out.push({ kind: 'text', text: s.slice(last), num: 0 });
  return out;
}

function inlineHtml(s: string): string {
  let h = esc(s);
  h = h.replace(/`([^`]+)`/g, '<code>$1</code>');
  h = h.replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>');
  h = h.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  h = h.replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>');
  return h;
}

function inlineNodes(
  s: string,
  citations: Citation[],
  onCita: (c: Citation) => void,
  keyPrefix: string,
): ReactNode[] {
  const nodes: ReactNode[] = [];
  let k = 0;
  for (const part of splitCitas(s)) {
    if (part.kind === 'cita') {
      const c = citations.find((x) => x.n === part.num);
      if (c) {
        nodes.push(
          <button
            key={`${keyPrefix}-${k++}`}
            type="button"
            className="md-cita"
            title={`${c.ruta} — ${c.titulo}${c.secop_ref ? ` · SECOP ${c.secop_ref}` : ''}`}
            onClick={() => onCita(c)}
          >
            [{c.n}]
          </button>,
        );
        if (c.secop_ref) {
          nodes.push(
            <span key={`${keyPrefix}-${k++}`} className="md-secop" title={`Contrato SECOP ${c.secop_ref}`}>
              SECOP
            </span>,
          );
        }
      } else {
        nodes.push(<span key={`${keyPrefix}-${k++}`}>{part.text}</span>);
      }
    } else {
      nodes.push(
        <span
          key={`${keyPrefix}-${k++}`}
          dangerouslySetInnerHTML={{ __html: inlineHtml(part.text) }}
        />,
      );
    }
  }
  return nodes;
}

export default function Markdown({
  content,
  citations,
  onCita,
}: {
  content: string;
  citations: Citation[];
  onCita: (c: Citation) => void;
}): ReactNode {
  const blocks: ReactNode[] = [];
  const lines = content.split('\n');
  let i = 0;
  let key = 0;
  let listBuf: string[] = [];
  let orderedBuf: string[] = [];

  function flushLists(): void {
    if (listBuf.length) {
      const items = listBuf;
      listBuf = [];
      blocks.push(
        <ul key={key++}>
          {items.map((t, j) => (
            <li key={j}>{inlineNodes(t, citations, onCita, `u${key}-${j}`)}</li>
          ))}
        </ul>,
      );
    }
    if (orderedBuf.length) {
      const items = orderedBuf;
      orderedBuf = [];
      blocks.push(
        <ol key={key++}>
          {items.map((t, j) => (
            <li key={j}>{inlineNodes(t, citations, onCita, `o${key}-${j}`)}</li>
          ))}
        </ol>,
      );
    }
  }

  function esSepTabla(line: string): boolean {
    const celdas = line.trim().replace(/^\||\|$/g, '').split('|');
    return celdas.length > 0 && celdas.every((c) => /^:?-+:?$/.test(c.trim()));
  }

  function celdasTabla(line: string): string[] {
    return line.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
  }

  while (i < lines.length) {
    const line = lines[i];
    // Tabla GFM: cabecera + separador + filas.
    if (
      line.includes('|') &&
      i + 1 < lines.length &&
      esSepTabla(lines[i + 1]) &&
      celdasTabla(line).length > 1
    ) {
      flushLists();
      const head = celdasTabla(line);
      const rows: string[][] = [];
      i += 2;
      while (i < lines.length && lines[i].includes('|') && lines[i].trim() !== '') {
        rows.push(celdasTabla(lines[i]));
        i++;
      }
      blocks.push(
        <table key={key++} className="md-tabla">
          <thead>
            <tr>
              {head.map((t, j) => (
                <th key={j}>{inlineNodes(t, citations, onCita, `th${key}-${j}`)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, j) => (
              <tr key={j}>
                {head.map((_, k) => (
                  <td key={k}>{inlineNodes(r[k] ?? '', citations, onCita, `td${key}-${j}-${k}`)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>,
      );
      continue;
    }
    // Cita: líneas que empiezan con >.
    if (/^>\s?/.test(line)) {
      flushLists();
      const quote: string[] = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) {
        quote.push(lines[i].replace(/^>\s?/, ''));
        i++;
      }
      blocks.push(
        <blockquote key={key++}>
          {inlineNodes(quote.join('\n'), citations, onCita, `q${key}`)}
        </blockquote>,
      );
      continue;
    }
    if (line.trim().startsWith('```')) {
      flushLists();
      const code: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        code.push(lines[i]);
        i++;
      }
      i++;
      blocks.push(
        <pre key={key++}>
          <code>{code.join('\n')}</code>
        </pre>,
      );
      continue;
    }
    const h = /^(#{1,3})\s+(.*)$/.exec(line);
    if (h) {
      flushLists();
      const level = h[1].length;
      const text = h[2];
      if (level === 1) blocks.push(<h4 key={key++}>{inlineNodes(text, citations, onCita, `h${key}`)}</h4>);
      else if (level === 2) blocks.push(<h5 key={key++}>{inlineNodes(text, citations, onCita, `h${key}`)}</h5>);
      else blocks.push(<h6 key={key++}>{inlineNodes(text, citations, onCita, `h${key}`)}</h6>);
      i++;
      continue;
    }
    const ul = /^[-*]\s+(.*)$/.exec(line);
    if (ul) {
      if (orderedBuf.length) flushLists();
      listBuf.push(ul[1]);
      i++;
      continue;
    }
    const ol = /^\d+[.)]\s+(.*)$/.exec(line);
    if (ol) {
      if (listBuf.length) flushLists();
      orderedBuf.push(ol[1]);
      i++;
      continue;
    }
    if (line.trim() === '' || line.trim() === '---') {
      flushLists();
      i++;
      continue;
    }
    flushLists();
    const para: string[] = [line];
    i++;
    while (
      i < lines.length &&
      lines[i].trim() !== '' &&
      !/^(#{1,3})\s+/.test(lines[i]) &&
      !/^[-*]\s+/.test(lines[i]) &&
      !/^\d+[.)]\s+/.test(lines[i]) &&
      !lines[i].trim().startsWith('```')
    ) {
      para.push(lines[i]);
      i++;
    }
    const text = para.join('\n');
    blocks.push(<p key={key++}>{inlineNodes(text, citations, onCita, `p${key}`)}</p>);
  }
  flushLists();
  return <div className="md">{blocks}</div>;
}
