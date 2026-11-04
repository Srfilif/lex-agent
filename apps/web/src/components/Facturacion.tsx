import { useEffect, useState } from 'react';
import { AuthHttpError, mensajeError } from '../auth';
import {
  cambiarPlan,
  cancelarSuscripcion,
  entregarWebhook,
  fetchEntitlements,
  fetchHistorial,
  fetchPagos,
  fetchPlanes,
  fetchSuscripcion,
  fetchUso,
  iniciarCheckout,
  reanudarSuscripcion,
  simularDecision,
  type Entitlements,
  type EventoSuscripcion,
  type Pago,
  type Plan,
  type SimuladorDecision,
  type Suscripcion,
  type Uso,
} from '../cuenta';

function describe(e: unknown): string {
  if (e instanceof AuthHttpError) {
    if (e.status === 403) return 'Sin permiso para esa acción.';
    return mensajeError(e.status, e.message);
  }
  return (e as Error).message || 'Ocurrió un error inesperado.';
}

function cop(minor: number | null, currency: string): string {
  if (minor === null) return 'Incluido (gratis)';
  return `$${minor.toLocaleString('es-CO')} ${currency}`;
}

export default function Facturacion(): React.ReactElement {
  const [planes, setPlanes] = useState<Plan[]>([]);
  const [sub, setSub] = useState<Suscripcion | null>(null);
  const [uso, setUso] = useState<Uso | null>(null);
  const [ent, setEnt] = useState<Entitlements | null>(null);
  const [pagos, setPagos] = useState<Pago[]>([]);
  const [hist, setHist] = useState<EventoSuscripcion[]>([]);
  const [planHist, setPlanHist] = useState('');
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const [cargando, setCargando] = useState(true);
  const [busy, setBusy] = useState(false);
  // Checkout sandbox
  const [planElegido, setPlanElegido] = useState('plus');
  const [sim, setSim] = useState<SimuladorDecision | null>(null);
  const [checkoutId, setCheckoutId] = useState('');

  async function cargar(): Promise<void> {
    setCargando(true);
    setErr('');
    try {
      const [pl, s, u, e, pg] = await Promise.all([
        fetchPlanes(),
        fetchSuscripcion(),
        fetchUso(),
        fetchEntitlements(),
        fetchPagos(),
      ]);
      setPlanes(pl);
      setSub(s);
      setUso(u);
      setEnt(e);
      setPagos(pg);
      try {
        const h = await fetchHistorial();
        setHist(h.eventos);
        setPlanHist(h.plan);
      } catch (eHist) {
        // Sin suscripción viva no hay historial: no es un error fatal.
        if (eHist instanceof AuthHttpError && (eHist.status === 404 || eHist.status === 400)) {
          setHist([]);
        } else {
          throw eHist;
        }
      }
    } catch (e) {
      setErr(describe(e));
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    void cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function checkout(): Promise<void> {
    setBusy(true);
    setErr('');
    setMsg('');
    setSim(null);
    try {
      const co = await iniciarCheckout(planElegido);
      setCheckoutId(co.checkout_id);
      setMsg(
        `Cobro pendiente creado: ${co.plan} por ${cop(co.amount_minor, co.currency)}. ` +
          'Pago simulado, sin cobro real. Aprueba o rechaza abajo y luego entrega el webhook.',
      );
    } catch (e) {
      setErr(describe(e));
    } finally {
      setBusy(false);
    }
  }

  async function decidir(aprobar: boolean): Promise<void> {
    if (!checkoutId) return;
    setBusy(true);
    setErr('');
    try {
      const d = await simularDecision(checkoutId, aprobar);
      setSim(d);
      setMsg(
        aprobar
          ? 'Simulador: pago aprobado. Falta entregar el webhook para activar el plan.'
          : 'Simulador: pago rechazado. Entrégalo para registrar el fallo (no tocará tu plan actual).',
      );
    } catch (e) {
      setErr(describe(e));
    } finally {
      setBusy(false);
    }
  }

  async function entregar(): Promise<void> {
    if (!sim) return;
    setBusy(true);
    setErr('');
    try {
      const r = await entregarWebhook(sim);
      const estado = typeof r['status'] === 'string' ? (r['status'] as string) : 'ok';
      const plan = typeof r['plan'] === 'string' ? (r['plan'] as string) : '';
      setMsg(`Webhook entregado: ${estado}${plan ? ` (plan ${plan})` : ''}. Suscripción recargada abajo.`);
      setSim(null);
      setCheckoutId('');
      await cargar();
    } catch (e) {
      setErr(describe(e));
    } finally {
      setBusy(false);
    }
  }

  async function accionar(nombre: string, fn: () => Promise<unknown>, ok: string): Promise<void> {
    setBusy(true);
    setErr('');
    setMsg('');
    try {
      await fn();
      setMsg(`${ok} (${nombre}).`);
      await cargar();
    } catch (e) {
      setErr(describe(e));
    } finally {
      setBusy(false);
    }
  }

  if (cargando) return <p className="meta">Cargando facturación…</p>;

  return (
    <div>
      {err && <p className="error" role="alert">{err}</p>}
      {msg && <p className="ok">{msg}</p>}

      <section className="cuenta-bloque">
        <h3>Suscripción actual</h3>
        {sub ? (
          <dl className="datos">
            <div><dt>Plan</dt><dd>{sub.plan_name} ({sub.plan})</dd></div>
            <div><dt>Estado</dt><dd>{sub.status}</dd></div>
            <div><dt>Renovación</dt><dd>{sub.current_period_end ? new Date(sub.current_period_end).toLocaleString('es-CO') : '—'}</dd></div>
            <div><dt>Se cancela al final del periodo</dt><dd>{sub.cancel_at_period_end ? 'Sí' : 'No'}</dd></div>
          </dl>
        ) : (
          <p className="meta">Sin suscripción (plan gratuito).</p>
        )}
        <div className="fila">
          <button
            type="button"
            className="secundario-claro"
            disabled={busy}
            onClick={() => void accionar('cancelar', cancelarSuscripcion, 'Renovación cancelada; mantienes acceso hasta fin de periodo')}
          >
            Cancelar renovación
          </button>
          <button
            type="button"
            className="secundario-claro"
            disabled={busy}
            onClick={() => void accionar('reanudar', reanudarSuscripcion, 'Suscripción reanudada')}
          >
            Reanudar
          </button>
        </div>
      </section>

      <section className="cuenta-bloque">
        <h3>Cambiar de plan</h3>
        <p className="meta">Cambio inmediato con periodo nuevo de 30 días, sin prorrota (sandbox). Requiere suscripción de pago: free → pago va por checkout.</p>
        <div className="fila">
          <select value={planElegido} onChange={(e) => setPlanElegido(e.target.value)} disabled={busy}>
            {planes.filter((p) => p.price_minor !== null).map((p) => (
              <option key={p.code} value={p.code}>{p.name} ({cop(p.price_minor, p.currency)})</option>
            ))}
          </select>
          <button
            type="button"
            className="secundario-claro"
            disabled={busy}
            onClick={() => void accionar('cambio de plan', () => cambiarPlan(planElegido), `Plan cambiado a ${planElegido}`)}
          >
            Cambiar plan
          </button>
        </div>
      </section>

      <section className="cuenta-bloque">
        <h3>Planes</h3>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Plan</th><th>Precio</th><th>Investigaciones/mes</th><th>Tokens/mes</th><th>Modelos</th></tr>
            </thead>
            <tbody>
              {planes.map((p) => (
                <tr key={p.code}>
                  <td><strong>{p.name}</strong> ({p.code})<br /><span className="meta">{p.description}</span></td>
                  <td className="num">{cop(p.price_minor, p.currency)}</td>
                  <td className="num">{p.limites.investigaciones_mes}</td>
                  <td className="num">{p.limites.tokens_mes}</td>
                  <td>{p.limites.modelos.join(', ') || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="cuenta-bloque">
        <h3>Checkout sandbox (pago simulado, sin cobro real)</h3>
        <div className="fila">
          <select value={planElegido} onChange={(e) => setPlanElegido(e.target.value)} disabled={busy}>
            {planes.map((p) => (
              <option key={p.code} value={p.code}>{p.name} — {cop(p.price_minor, p.currency)}</option>
            ))}
          </select>
          <button type="button" onClick={() => void checkout()} disabled={busy}>
            {busy ? 'Creando…' : 'Iniciar checkout'}
          </button>
        </div>
        {checkoutId && (
          <p className="meta">Checkout pendiente: <code className="romper">{checkoutId}</code></p>
        )}
        {checkoutId && (
          <div className="fila">
            <button type="button" className="secundario-claro" onClick={() => void decidir(true)} disabled={busy}>
              Aprobar pago
            </button>
            <button type="button" className="secundario-claro peligro" onClick={() => void decidir(false)} disabled={busy}>
              Rechazar pago
            </button>
          </div>
        )}
        {sim && (
          <div className="totp-caja">
            <p>
              El simulador firmó el evento. Ahora entrega el webhook tal cual (cuerpo crudo +
              encabezado <code>{sim.signature_header}</code>):
            </p>
            <div className="fila">
              <button type="button" onClick={() => void entregar()} disabled={busy}>
                {busy ? 'Entregando…' : 'Entregar webhook y activar'}
              </button>
            </div>
          </div>
        )}
      </section>

      <section className="cuenta-bloque">
        <h3>Uso del periodo {uso?.period}</h3>
        {uso && (
          <dl className="datos">
            <div><dt>Investigaciones</dt><dd>{uso.investigaciones.used} / {uso.investigaciones.limit} (quedan {uso.investigaciones.remaining})</dd></div>
            <div><dt>Tokens</dt><dd>{uso.tokens.used} / {uso.tokens.limit} (quedan {uso.tokens.remaining})</dd></div>
            <div><dt>Reinicio</dt><dd>{uso.reset_at ? new Date(uso.reset_at).toLocaleString('es-CO') : '—'}</dd></div>
          </dl>
        )}
        <h3>Lo que tu plan permite</h3>
        {ent && (
          <dl className="datos">
            <div><dt>Plan efectivo</dt><dd>{ent.plan}</dd></div>
            <div><dt>Puede investigar</dt><dd>{ent.puede_investigar ? 'Sí' : 'No (cuota agotada)'}</dd></div>
            <div><dt>Modelos</dt><dd>{ent.modelos.join(', ') || '—'}</dd></div>
          </dl>
        )}
      </section>

      <section className="cuenta-bloque">
        <h3>Pagos</h3>
        {pagos.length === 0 ? (
          <p className="meta">Aún no hay pagos.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Fecha</th><th>Plan</th><th>Monto</th><th>Estado</th><th>Proveedor</th></tr>
              </thead>
              <tbody>
                {pagos.map((p) => (
                  <tr key={p.id}>
                    <td>{p.created_at ? new Date(p.created_at).toLocaleString('es-CO') : '—'}</td>
                    <td>{p.plan}</td>
                    <td className="num">{cop(p.amount_minor, p.currency)}</td>
                    <td>{p.status}</td>
                    <td>{p.provider}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="cuenta-bloque">
        <h3>Historial de suscripción {planHist ? `(${planHist})` : ''}</h3>
        {hist.length === 0 ? (
          <p className="meta">Sin eventos todavía (aparecen al activar, cancelar o cambiar de plan).</p>
        ) : (
          <ul className="historial">
            {hist.map((e, i) => (
              <li key={`${e.created_at}-${i}`}>
                <strong>{e.type}</strong> <span className="meta">{e.from} → {e.to}</span>
                <br />
                <span className="meta">{e.created_at ? new Date(e.created_at).toLocaleString('es-CO') : ''}</span>
              </li>
            ))}
          </ul>
        )}
        <button type="button" className="secundario-claro" onClick={() => void cargar()} disabled={busy}>
          Recargar
        </button>
      </section>
    </div>
  );
}
