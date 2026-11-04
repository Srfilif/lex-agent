import { useState } from 'react';
import type { Contrato } from '../api';
import { api } from '../api';

const fmtCOP = (v: number | null) =>
  v === null || v === undefined || Number.isNaN(v)
    ? '—'
    : new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(v);

export default function Secop() {
  const [f, setF] = useState({ entidad: '', proveedor: '', objeto: '', valor_min: '', modalidad: '', anio: '' });
  const [rows, setRows] = useState<Contrato[] | null>(null);
  const [meta, setMeta] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setF({ ...f, [k]: e.target.value });

  async function buscar(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const p: Record<string, string> = { limit: '20' };
      for (const [k, v] of Object.entries(f)) if (v.trim()) p[k] = v.trim();
      const r = await api.contratos(p);
      setRows(r.contratos);
      setMeta(`${r.count} contratos · consulta ${new Date(r.fecha_consulta).toLocaleString('es-CO')}`);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section>
      <h2>Contratos SECOP II</h2>
      <form className="secop-form" onSubmit={buscar}>
        <input placeholder="Entidad" value={f.entidad} onChange={set('entidad')} />
        <input placeholder="Proveedor" value={f.proveedor} onChange={set('proveedor')} />
        <input placeholder="Objeto" value={f.objeto} onChange={set('objeto')} />
        <input placeholder="Valor mín (COP)" inputMode="numeric" value={f.valor_min} onChange={set('valor_min')} />
        <input placeholder="Modalidad" value={f.modalidad} onChange={set('modalidad')} />
        <input placeholder="Año" inputMode="numeric" value={f.anio} onChange={set('anio')} />
        <button type="submit" disabled={loading}>{loading ? 'Buscando…' : 'Buscar'}</button>
      </form>
      {error && <p className="error">{error}</p>}
      {meta && <p className="meta">{meta}</p>}
      {rows && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Entidad</th><th>Proveedor</th><th>Objeto</th><th>Valor</th><th>Modalidad</th><th>Señales</th><th /></tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.id_contrato + c.nombre_entidad}>
                  <td>{c.nombre_entidad}</td>
                  <td>{c.proveedor_adjudicado}</td>
                  <td className="objeto">{(c.objeto_del_contrato || c.descripcion_del_proceso || '—').slice(0, 160)}</td>
                  <td className="num">{fmtCOP(c.valor_del_contrato)}</td>
                  <td>{c.modalidad_de_contratacion || '—'}</td>
                  <td>{c.senales.length ? c.senales.map((s) => (
                    <span key={s.regla} className="senial" title={s.detalle}>{s.regla}</span>
                  )) : '—'}</td>
                  <td><a href={c.enlace_origen} target="_blank" rel="noreferrer">origen</a></td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length === 0 && <p className="meta">Sin resultados con esos filtros.</p>}
        </div>
      )}
    </section>
  );
}
