import { useState } from 'react';
import type { Contrato } from '../api';
import { api } from '../api';
import { Alert, AlertDescription } from './ui/alert';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';

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
        <Input placeholder="Entidad" value={f.entidad} onChange={set('entidad')} />
        <Input placeholder="Proveedor" value={f.proveedor} onChange={set('proveedor')} />
        <Input placeholder="Objeto" value={f.objeto} onChange={set('objeto')} />
        <Input placeholder="Valor mín (COP)" inputMode="numeric" value={f.valor_min} onChange={set('valor_min')} />
        <Input placeholder="Modalidad" value={f.modalidad} onChange={set('modalidad')} />
        <Input placeholder="Año" inputMode="numeric" value={f.anio} onChange={set('anio')} />
        <Button type="submit" disabled={loading}>{loading ? 'Buscando…' : 'Buscar'}</Button>
      </form>
      {error && (
        <Alert variant="destructive" className="my-2 border-destructive/30 bg-destructive/5">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {meta && <p className="meta">{meta}</p>}
      {rows && (
        <div className="table-wrap">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Entidad</TableHead>
                <TableHead>Proveedor</TableHead>
                <TableHead>Objeto</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Modalidad</TableHead>
                <TableHead>Señales</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((c) => (
                <TableRow key={c.id_contrato + c.nombre_entidad}>
                  <TableCell>{c.nombre_entidad}</TableCell>
                  <TableCell>{c.proveedor_adjudicado}</TableCell>
                  <TableCell className="max-w-[320px] whitespace-normal">{(c.objeto_del_contrato || c.descripcion_del_proceso || '—').slice(0, 160)}</TableCell>
                  <TableCell className="text-right tabular-nums">{fmtCOP(c.valor_del_contrato)}</TableCell>
                  <TableCell>{c.modalidad_de_contratacion || '—'}</TableCell>
                  <TableCell>{c.senales.length ? c.senales.map((s) => (
                    <span key={s.regla} className="senial" title={s.detalle}>{s.regla}</span>
                  )) : '—'}</TableCell>
                  <TableCell>
                    <Button asChild variant="link" size="sm" className="h-auto p-0 text-xs">
                      <a href={c.enlace_origen} target="_blank" rel="noreferrer">origen</a>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {rows.length === 0 && <p className="meta">Sin resultados con esos filtros.</p>}
        </div>
      )}
    </section>
  );
}
