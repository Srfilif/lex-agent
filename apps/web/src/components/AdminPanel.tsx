import { useEffect, useState } from 'react';
import { AuthHttpError, mensajeError } from '../auth';
import {
  adminCambiarEstado,
  adminCambiarRol,
  adminListarUsuarios,
  adminOtorgarPlan,
  adminResetTotp,
  type AdminUsuario,
} from '../cuenta';

function describe(e: unknown): string {
  if (e instanceof AuthHttpError) {
    if (e.status === 403) return 'Sin permiso: esta acción es solo para administradores.';
    return mensajeError(e.status, e.message);
  }
  return (e as Error).message || 'Ocurrió un error inesperado.';
}

export default function AdminPanel(): React.ReactElement {
  const [q, setQ] = useState('');
  const [total, setTotal] = useState(0);
  const [usuarios, setUsuarios] = useState<AdminUsuario[]>([]);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [confirmReset, setConfirmReset] = useState<string | null>(null);
  // grant
  const [grantId, setGrantId] = useState('');
  const [grantPlan, setGrantPlan] = useState('plus');
  const [grantDias, setGrantDias] = useState('30');

  async function cargar(): Promise<void> {
    setCargando(true);
    setErr('');
    try {
      const r = await adminListarUsuarios(q);
      setTotal(r.total);
      setUsuarios(r.usuarios);
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

  async function accionar(ok: string, fn: () => Promise<unknown>): Promise<void> {
    setBusy(true);
    setErr('');
    setMsg('');
    try {
      await fn();
      setMsg(ok);
      await cargar();
    } catch (e) {
      setErr(describe(e));
    } finally {
      setBusy(false);
      setConfirmReset(null);
    }
  }

  async function otorgar(): Promise<void> {
    const dias = Number.parseInt(grantDias, 10);
    if (!grantId.trim() || !grantPlan.trim() || !Number.isInteger(dias) || dias < 1 || dias > 365) {
      setErr('Grant: user_id válido, plan y días entre 1 y 365.');
      return;
    }
    await accionar('Plan otorgado.', () => adminOtorgarPlan(grantId.trim(), grantPlan.trim().toLowerCase(), dias));
  }

  if (cargando) return <p className="meta">Cargando usuarios…</p>;

  return (
    <div>
      {err && <p className="error" role="alert">{err}</p>}
      {msg && <p className="ok">{msg}</p>}

      <section className="cuenta-bloque">
        <h3>Usuarios ({total})</h3>
        <form
          className="fila"
          onSubmit={(e) => {
            e.preventDefault();
            void cargar();
          }}
        >
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por correo" maxLength={100} />
          <button type="submit" className="secundario-claro" disabled={busy}>Buscar</button>
        </form>
        {usuarios.length === 0 && !err && <p className="meta">Sin usuarios para mostrar.</p>}
        <ul className="admin-lista">
          {usuarios.map((u) => (
            <li key={u.id}>
              <div>
                <strong>{u.email}</strong> <span className="meta">({u.role} · {u.status})</span>
                <br />
                <span className="meta">
                  {u.display_name || 'Sin nombre'} · {u.email_verified ? 'verificado' : 'sin verificar'} ·{' '}
                  {u.created_at ? new Date(u.created_at).toLocaleDateString('es-CO') : '—'}
                </span>
                <br />
                <code className="romper mini-id">{u.id}</code>
              </div>
              <div className="fila">
                <button
                  type="button"
                  className="secundario-claro"
                  disabled={busy}
                  onClick={() => void accionar('Estado actualizado.', () =>
                    adminCambiarEstado(u.id, u.status === 'active' ? 'disabled' : 'active'))}
                >
                  {u.status === 'active' ? 'Deshabilitar' : 'Habilitar'}
                </button>
                <button
                  type="button"
                  className="secundario-claro"
                  disabled={busy}
                  onClick={() => void accionar('Rol actualizado.', () =>
                    adminCambiarRol(u.id, u.role === 'admin' ? 'user' : 'admin'))}
                >
                  {u.role === 'admin' ? 'Quitar admin' : 'Hacer admin'}
                </button>
                {confirmReset === u.id ? (
                  <>
                    <span className="meta">¿Borrar su 2FA? Se cierran sus sesiones.</span>
                    <button
                      type="button"
                      className="secundario-claro peligro"
                      disabled={busy}
                      onClick={() => void accionar('TOTP reiniciado.', () => adminResetTotp(u.id))}
                    >
                      Confirmar reset TOTP
                    </button>
                    <button type="button" className="secundario-claro" onClick={() => setConfirmReset(null)}>
                      Cancelar
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    className="secundario-claro peligro"
                    disabled={busy}
                    onClick={() => setConfirmReset(u.id)}
                  >
                    Reset TOTP
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="cuenta-bloque">
        <h3>Otorgar plan (grant manual auditado)</h3>
        <p className="meta">Cuerpo exacto del backend: user_id (UUID), plan (minúsculas) y días (1–365).</p>
        <div className="fila">
          <input value={grantId} onChange={(e) => setGrantId(e.target.value)} placeholder="user_id (UUID)" />
          <input value={grantPlan} onChange={(e) => setGrantPlan(e.target.value)} placeholder="plan" maxLength={20} />
          <input value={grantDias} onChange={(e) => setGrantDias(e.target.value)} placeholder="días" inputMode="numeric" />
          <button type="button" onClick={() => void otorgar()} disabled={busy}>Otorgar</button>
        </div>
      </section>
    </div>
  );
}
