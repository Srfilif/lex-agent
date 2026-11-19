import { useEffect, useState } from 'react';
import { KeyRound, ListPlus, Lock, Ticket, Trash2 } from 'lucide-react';
import { AuthHttpError, mensajeError } from '../auth';
import {
  adminAccessMode,
  adminCodeCreate,
  adminCodeRevoke,
  adminCodesList,
  adminWhitelistAdd,
  adminWhitelistList,
  adminWhitelistRemove,
  type AccessCodeRow,
  type AccessModeAdmin,
  type WhitelistEntry,
} from '../cuenta';
import { Alert, AlertDescription } from './ui/alert';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Input } from './ui/input';

function describe(e: unknown): string {
  if (e instanceof AuthHttpError) {
    if (e.status === 403) return 'Sin permiso: esta acción es solo para administradores.';
    return mensajeError(e.status, e.message);
  }
  return (e as Error).message || 'Ocurrió un error inesperado.';
}

/** Gestión del modo de acceso: whitelist y códigos de invitación. */
export default function AccessAdmin(): React.ReactElement {
  const [modo, setModo] = useState<AccessModeAdmin | null>(null);
  const [lista, setLista] = useState<WhitelistEntry[]>([]);
  const [codigos, setCodigos] = useState<AccessCodeRow[]>([]);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [patron, setPatron] = useState('');
  const [etiquetaW, setEtiquetaW] = useState('');
  const [etiquetaC, setEtiquetaC] = useState('');
  const [usos, setUsos] = useState('1');
  const [dias, setDias] = useState('');
  const [nuevoCodigo, setNuevoCodigo] = useState('');

  async function cargar(): Promise<void> {
    setCargando(true);
    setErr('');
    try {
      const [m, w, c] = await Promise.all([
        adminAccessMode(),
        adminWhitelistList(),
        adminCodesList(),
      ]);
      setModo(m);
      setLista(w);
      setCodigos(c);
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
    }
  }

  async function agregar(): Promise<void> {
    if (!patron.trim()) {
      setErr('Escribe un correo exacto o un patrón *@dominio.tld.');
      return;
    }
    await accionar('Patrón agregado.', () => adminWhitelistAdd(patron.trim(), etiquetaW.trim()));
    setPatron('');
    setEtiquetaW('');
  }

  async function crear(): Promise<void> {
    const maxUses = Number.parseInt(usos, 10);
    const expires = dias.trim() === '' ? null : Number.parseInt(dias, 10);
    if (!Number.isInteger(maxUses) || maxUses < 1 || maxUses > 10000) {
      setErr('Usos entre 1 y 10000.');
      return;
    }
    if (expires !== null && (!Number.isInteger(expires) || expires < 1 || expires > 3650)) {
      setErr('Días entre 1 y 3650 (o vacío = sin expiración).');
      return;
    }
    setBusy(true);
    setErr('');
    setMsg('');
    setNuevoCodigo('');
    try {
      const c = await adminCodeCreate(etiquetaC.trim(), maxUses, expires);
      setNuevoCodigo(c.code);
      setMsg('Código creado. Cópialo ahora: no se vuelve a mostrar.');
      setEtiquetaC('');
      setUsos('1');
      setDias('');
      await cargar();
    } catch (e) {
      setErr(describe(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="cuenta-bloque" style={{ marginTop: 'var(--space-4)' }}>
      <div className="section-head">
        <h3 style={{ margin: 0 }}>
          <Lock size={15} style={{ verticalAlign: '-2px', marginRight: 5 }} />
          Acceso a la plataforma
        </h3>
        {modo && <span className="chip">Modo: {modo.mode}</span>}
      </div>
      {err && (
        <Alert variant="destructive" className="mb-3 border-destructive/30 bg-destructive/5">
          <AlertDescription>{err}</AlertDescription>
        </Alert>
      )}
      {msg && (
        <Alert className="mb-3 border-primary/20 bg-primary/5">
          <AlertDescription className="text-foreground">{msg}</AlertDescription>
        </Alert>
      )}
      {modo && (
        <p className="meta" style={{ fontSize: 'var(--text-xs)' }}>
          El modo se configura en el servidor (ACCESS_MODE) y requiere reinicio. Whitelist:{' '}
          {modo.env_whitelist_count} en .env + {modo.db_whitelist_count} en BD. Códigos activos:{' '}
          {modo.db_codes_active}
          {modo.static_code_configured ? ' (+ código estático del .env).' : '.'}
        </p>
      )}
      {cargando ? (
        <div className="skeleton" style={{ height: 60 }} />
      ) : (
        <>
          <h4 style={{ margin: 'var(--space-3) 0 var(--space-2)', fontSize: 'var(--text-sm)' }}>
            <ListPlus size={14} style={{ verticalAlign: '-2px', marginRight: 5 }} />
            Whitelist
          </h4>
          <div className="fila">
            <Input
              value={patron}
              onChange={(e) => setPatron(e.target.value)}
              placeholder="correo@x.co o *@dominio.co"
              maxLength={254}
              aria-label="Patrón de whitelist"
              style={{ flex: '2 1 240px' }}
            />
            <Input
              value={etiquetaW}
              onChange={(e) => setEtiquetaW(e.target.value)}
              placeholder="etiqueta (opcional)"
              maxLength={80}
              aria-label="Etiqueta"
              style={{ flex: '1 1 140px' }}
            />
            <Button type="button" onClick={() => void agregar()} disabled={busy}>
              Agregar
            </Button>
          </div>
          {lista.length === 0 ? (
            <p className="meta">Sin entradas en BD.</p>
          ) : (
            <ul className="admin-lista">
              {lista.map((w) => (
                <li key={w.id}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <strong style={{ fontSize: 'var(--text-sm)' }}>{w.pattern}</strong>
                    {w.label && <Badge variant="secondary">{w.label}</Badge>}
                    <span style={{ marginLeft: 'auto' }}>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="text-destructive"
                        disabled={busy}
                        onClick={() =>
                          void accionar('Entrada eliminada.', () =>
                            adminWhitelistRemove(w.id),
                          )
                        }
                      >
                        <Trash2 /> Eliminar
                      </Button>
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <h4 style={{ margin: 'var(--space-3) 0 var(--space-2)', fontSize: 'var(--text-sm)' }}>
            <Ticket size={14} style={{ verticalAlign: '-2px', marginRight: 5 }} />
            Códigos de acceso
          </h4>
          <div className="fila">
            <Input
              value={etiquetaC}
              onChange={(e) => setEtiquetaC(e.target.value)}
              placeholder="etiqueta (opcional)"
              maxLength={80}
              aria-label="Etiqueta del código"
              style={{ flex: '2 1 160px' }}
            />
            <Input
              value={usos}
              onChange={(e) => setUsos(e.target.value)}
              placeholder="usos"
              inputMode="numeric"
              aria-label="Usos máximos"
              style={{ flex: '1 1 70px' }}
            />
            <Input
              value={dias}
              onChange={(e) => setDias(e.target.value)}
              placeholder="días (opcional)"
              inputMode="numeric"
              aria-label="Días de vigencia"
              style={{ flex: '1 1 110px' }}
            />
            <Button type="button" onClick={() => void crear()} disabled={busy}>
              <KeyRound /> Crear código
            </Button>
          </div>
          {nuevoCodigo && (
            <Alert className="mb-3 border-primary/20 bg-primary/5">
              <AlertDescription className="text-foreground">
                Código nuevo (única vez): <code className="romper">{nuevoCodigo}</code>
              </AlertDescription>
            </Alert>
          )}
          {codigos.length === 0 ? (
            <p className="meta">Sin códigos en BD.</p>
          ) : (
            <ul className="admin-lista">
              {codigos.map((c) => (
                <li key={c.id}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <strong style={{ fontSize: 'var(--text-sm)' }}>
                      {c.label || 'Sin etiqueta'}
                    </strong>
                    <Badge variant="secondary">
                      {c.used_count}/{c.max_uses} usos
                    </Badge>
                    {c.expires_at && (
                      <span className="meta" style={{ fontSize: 'var(--text-xs)' }}>
                        expira {new Date(c.expires_at).toLocaleDateString('es-CO')}
                      </span>
                    )}
                    {c.revoked_at && <Badge variant="destructive">revocado</Badge>}
                    {!c.revoked_at && c.used_count < c.max_uses && (
                      <span style={{ marginLeft: 'auto' }}>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="text-destructive"
                          disabled={busy}
                          onClick={() =>
                            void accionar('Código revocado.', () => adminCodeRevoke(c.id))
                          }
                        >
                          <Trash2 /> Revocar
                        </Button>
                      </span>
                    )}
                  </div>
                  <code className="romper mini-id">{c.id}</code>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}
