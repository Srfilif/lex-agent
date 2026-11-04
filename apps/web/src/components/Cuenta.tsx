import { useState } from 'react';
import type { Me, Preferencias } from '../cuenta';
import AdminPanel from './AdminPanel';
import Datos from './cuenta/Datos';
import Facturacion from './Facturacion';
import Perfil from './cuenta/Perfil';
import PreferenciasView from './cuenta/PreferenciasView';
import Seguridad from './cuenta/Seguridad';
import Sesiones from './cuenta/Sesiones';

export type SubVista = 'perfil' | 'preferencias' | 'seguridad' | 'sesiones' | 'facturacion' | 'admin';

const PESTANAS: Array<{ id: SubVista; titulo: string }> = [
  { id: 'perfil', titulo: 'Perfil' },
  { id: 'preferencias', titulo: 'Preferencias' },
  { id: 'seguridad', titulo: 'Seguridad' },
  { id: 'sesiones', titulo: 'Sesiones' },
  { id: 'facturacion', titulo: 'Facturación' },
  { id: 'admin', titulo: 'Admin' },
];

export default function Cuenta({
  me,
  onMe,
  onPrefs,
  onSesionCerrada,
}: {
  me: Me;
  onMe: (m: Me) => void;
  onPrefs: (p: Preferencias) => void;
  onSesionCerrada: () => void;
}): React.ReactElement {
  const esAdmin = me.role === 'admin';
  const [tab, setTab] = useState<SubVista>('perfil');

  return (
    <div className="cuenta">
      <div className="cuenta-tabs" role="tablist" aria-label="Secciones de la cuenta">
        {PESTANAS.filter((p) => p.id !== 'admin' || esAdmin).map((p) => (
          <button
            key={p.id}
            type="button"
            role="tab"
            aria-selected={tab === p.id}
            className={tab === p.id ? 'activo' : ''}
            onClick={() => setTab(p.id)}
          >
            {p.titulo}
          </button>
        ))}
      </div>
      {tab === 'perfil' && (
        <>
          <Perfil me={me} onMe={onMe} />
          <Datos me={me} onSesionCerrada={onSesionCerrada} />
        </>
      )}
      {tab === 'preferencias' && <PreferenciasView onPrefs={onPrefs} />}
      {tab === 'seguridad' && <Seguridad onSesionCerrada={onSesionCerrada} />}
      {tab === 'sesiones' && <Sesiones onSesionCerrada={onSesionCerrada} />}
      {tab === 'facturacion' && <Facturacion />}
      {tab === 'admin' && esAdmin && <AdminPanel />}
      {tab === 'admin' && !esAdmin && (
        <p className="error" role="alert">Sin permiso: esta sección es solo para administradores.</p>
      )}
    </div>
  );
}
