import { useEffect, useState } from 'react';
import { Ban, CheckCircle2, KeyRound, Search, ShieldCheck, UserCog, Users } from 'lucide-react';
import { AuthHttpError, mensajeError } from '../auth';
import {
  adminCambiarEstado,
  adminCambiarRol,
  adminListarUsuarios,
  adminOtorgarPlan,
  adminResetTotp,
  type AdminUsuario,
} from '../cuenta';
import { Alert, AlertDescription } from './ui/alert';
import { Avatar, AvatarFallback } from './ui/avatar';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Input } from './ui/input';
import AccessAdmin from './AccessAdmin';

function describe(e: unknown): string {
  if (e instanceof AuthHttpError) {
    if (e.status === 403) return 'Sin permiso: esta acción es solo para administradores.';
    return mensajeError(e.status, e.message);
  }
  return (e as Error).message || 'Ocurrió un error inesperado.';
}

function inicial(u: AdminUsuario): string {
  return (u.display_name || u.email).slice(0, 2).toUpperCase();
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
    await accionar('Plan otorgado.', () =>
      adminOtorgarPlan(grantId.trim(), grantPlan.trim().toLowerCase(), dias),
    );
  }

  const activos = usuarios.filter((u) => u.status === 'active').length;
  const admins = usuarios.filter((u) => u.role === 'admin').length;

  return (
    <div>
      {err && (
        <Alert variant="destructive" className="mb-3 border-destructive/30 bg-destructive/5">
          <AlertDescription>{err}</AlertDescription>
        </Alert>
      )}
      {msg && (
        <Alert className="mb-3 border-primary/20 bg-primary/5">
          <CheckCircle2 className="text-primary" />
          <AlertDescription className="text-foreground">{msg}</AlertDescription>
        </Alert>
      )}

      <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(3, minmax(0,1fr))' }}>
        <div className="stat">
          <div className="stat-value">{total}</div>
          <div className="stat-label">Usuarios</div>
        </div>
        <div className="stat">
          <div className="stat-value">{activos}</div>
          <div className="stat-label">Activos (página)</div>
        </div>
        <div className="stat">
          <div className="stat-value">{admins}</div>
          <div className="stat-label">Administradores</div>
        </div>
      </div>

      <section className="cuenta-bloque" style={{ marginTop: 'var(--space-4)' }}>
        <div className="section-head">
          <h3 style={{ margin: 0 }}>
            <Users size={15} style={{ verticalAlign: '-2px', marginRight: 5 }} />
            Usuarios
          </h3>
          <span className="chip">
            <ShieldCheck size={11} /> Acciones auditadas
          </span>
        </div>
        <form
          className="filter-bar"
          onSubmit={(e) => {
            e.preventDefault();
            void cargar();
          }}
          style={{ marginBottom: 'var(--space-2)' }}
        >
          <label style={{ position: 'relative', flex: '1 1 240px', maxWidth: 360 }}>
            <Search
              size={14}
              style={{
                position: 'absolute',
                left: 10,
                top: 10,
                color: 'var(--muted)',
                pointerEvents: 'none',
              }}
            />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar por correo…"
              maxLength={100}
              aria-label="Buscar usuarios por correo"
              className="w-full pl-9"
            />
          </label>
          <Button type="submit" variant="outline" disabled={busy}>
            Buscar
          </Button>
        </form>
        {cargando && (
          <div style={{ padding: 'var(--space-3) 0' }}>
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="skeleton"
                style={{ height: 32, margin: '0.5rem 0', width: `${90 - i * 8}%` }}
              />
            ))}
          </div>
        )}
        {!cargando && usuarios.length === 0 && !err && (
          <p className="meta">Sin usuarios para mostrar.</p>
        )}
        <ul className="admin-lista">
          {usuarios.map((u) => (
            <li key={u.id}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <Avatar className="size-8 border border-primary/20" aria-hidden="true">
                  <AvatarFallback className="bg-primary/10 text-[11px] font-bold text-primary">
                    {inicial(u)}
                  </AvatarFallback>
                </Avatar>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                    <strong style={{ fontSize: 'var(--text-sm)' }}>{u.email}</strong>
                    <Badge variant={u.role === 'admin' ? 'default' : 'secondary'}>{u.role}</Badge>
                    <Badge variant={u.status === 'active' ? 'outline' : 'destructive'}>
                      {u.status}
                    </Badge>
                  </div>
                  <p className="meta" style={{ fontSize: 'var(--text-xs)', marginTop: 2 }}>
                    {u.display_name || 'Sin nombre'} ·{' '}
                    {u.email_verified ? 'verificado' : 'sin verificar'} ·{' '}
                    {u.created_at ? new Date(u.created_at).toLocaleDateString('es-CO') : '—'}
                  </p>
                  <code className="romper mini-id">{u.id}</code>
                </div>
              </div>
              <div className="fila" style={{ margin: 0 }}>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={busy}
                  onClick={() =>
                    void accionar('Estado actualizado.', () =>
                      adminCambiarEstado(u.id, u.status === 'active' ? 'disabled' : 'active'),
                    )
                  }
                >
                  {u.status === 'active' ? <Ban /> : <CheckCircle2 />}{' '}
                  {u.status === 'active' ? 'Deshabilitar' : 'Habilitar'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={busy}
                  onClick={() =>
                    void accionar('Rol actualizado.', () =>
                      adminCambiarRol(u.id, u.role === 'admin' ? 'user' : 'admin'),
                    )
                  }
                >
                  <UserCog /> {u.role === 'admin' ? 'Quitar admin' : 'Hacer admin'}
                </Button>
                {confirmReset === u.id ? (
                  <>
                    <span className="meta" style={{ fontSize: 'var(--text-xs)' }}>
                      ¿Borrar su 2FA? Se cierran sus sesiones.
                    </span>
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      disabled={busy}
                      onClick={() => void accionar('TOTP reiniciado.', () => adminResetTotp(u.id))}
                    >
                      Confirmar reset
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setConfirmReset(null)}
                    >
                      Cancelar
                    </Button>
                  </>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="text-destructive"
                    disabled={busy}
                    onClick={() => setConfirmReset(u.id)}
                  >
                    <KeyRound /> Reset TOTP
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="cuenta-bloque">
        <h3>
          <ShieldCheck size={15} style={{ verticalAlign: '-2px', marginRight: 5 }} />
          Otorgar plan
        </h3>
        <p className="meta" style={{ fontSize: 'var(--text-xs)' }}>
          Concesión manual auditada. Requiere user_id (UUID), plan en minúsculas y días entre 1 y
          365.
        </p>
        <div className="fila">
          <Input
            value={grantId}
            onChange={(e) => setGrantId(e.target.value)}
            placeholder="user_id (UUID)"
            aria-label="Identificador del usuario"
            style={{ flex: '2 1 260px' }}
          />
          <Input
            value={grantPlan}
            onChange={(e) => setGrantPlan(e.target.value)}
            placeholder="plan"
            maxLength={20}
            aria-label="Plan"
            style={{ flex: '1 1 100px' }}
          />
          <Input
            value={grantDias}
            onChange={(e) => setGrantDias(e.target.value)}
            placeholder="días"
            inputMode="numeric"
            aria-label="Días"
            style={{ flex: '1 1 80px' }}
          />
          <Button type="button" onClick={() => void otorgar()} disabled={busy}>
            Otorgar plan
          </Button>
        </div>
      </section>

      <AccessAdmin />
    </div>
  );
}
