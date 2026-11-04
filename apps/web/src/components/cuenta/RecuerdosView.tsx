import { useState, useEffect } from 'react';
import {
  addRecuerdo,
  deleteRecuerdo,
  listRecuerdos,
  type Recuerdo,
} from '../../cuenta';
import Bloque, { describeError } from './comun';

export default function RecuerdosView(): React.ReactElement {
  const [items, setItems] = useState<Recuerdo[]>([]);
  const [max, setMax] = useState(50);
  const [nuevo, setNuevo] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [cargando, setCargando] = useState(true);

  async function refrescar(): Promise<void> {
    try {
      const r = await listRecuerdos();
      setItems(r.memories);
      setMax(r.max);
    } catch (e) {
      setErr(describeError(e));
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    void refrescar();
  }, []);

  async function agregar(): Promise<void> {
    const fact = nuevo.trim();
    if (!fact || busy) return;
    setBusy(true);
    setErr('');
    try {
      await addRecuerdo(fact);
      setNuevo('');
      await refrescar();
    } catch (e) {
      setErr(describeError(e));
    } finally {
      setBusy(false);
    }
  }

  async function borrar(id: string): Promise<void> {
    if (busy) return;
    setBusy(true);
    setErr('');
    try {
      await deleteRecuerdo(id);
      await refrescar();
    } catch (e) {
      setErr(describeError(e));
    } finally {
      setBusy(false);
    }
  }

  if (cargando) return <p className="meta">Cargando recuerdos…</p>;
  return (
    <>
      <p className="meta">
        {items.length}/{max} recuerdos. Solo se usan si la memoria entre chats está activada.
        El asistente también puede guardar hechos al resumir hilos largos.
      </p>
      {items.length === 0 ? (
        <p className="meta">Sin recuerdos. Agrega uno o activa la memoria y sigue conversando.</p>
      ) : (
        <ul className="recuerdos">
          {items.map((m) => (
            <li key={m.id}>
              <span>{m.fact}</span>{' '}
              <button type="button" disabled={busy} onClick={() => void borrar(m.id)}>
                Borrar
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="fila">
        <label>
          Nuevo recuerdo
          <input
            value={nuevo}
            disabled={busy}
            maxLength={500}
            placeholder="p. ej. Mi área es contratación estatal"
            onChange={(e) => setNuevo(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void agregar();
            }}
          />
        </label>
        <button type="button" disabled={busy || !nuevo.trim()} onClick={() => void agregar()}>
          Agregar
        </button>
      </div>
      {err && <p className="error" role="alert">{err}</p>}
    </>
  );
}
