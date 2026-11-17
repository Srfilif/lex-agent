import { useState } from 'react';
import type { Me, Preferencias } from '../cuenta';
import AdminPanel from './AdminPanel';
import Datos from './cuenta/Datos';
import Facturacion from './Facturacion';
import Perfil from './cuenta/Perfil';
import PreferenciasView from './cuenta/PreferenciasView';
import Seguridad from './cuenta/Seguridad';
import Sesiones from './cuenta/Sesiones';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';

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
  tabInicial = 'perfil',
}: {
  me: Me;
  onMe: (m: Me) => void;
  onPrefs: (p: Preferencias) => void;
  onSesionCerrada: () => void;
  tabInicial?: SubVista;
}): React.ReactElement {
  const esAdmin = me.role === 'admin';
  const [tab, setTab] = useState<SubVista>(tabInicial);

  return (
    <div className="cuenta">
      <div className="page-head" style={{ marginBottom: 'var(--space-4)' }}>
        <div>
          <span className="eyebrow">{tab === 'admin' ? 'Administración' : 'Tu espacio'}</span>
          <h1 className="page-title">{tab === 'admin' ? 'Administración' : 'Cuenta'}</h1>
          <p className="page-sub">
            {tab === 'admin'
              ? 'Usuarios, roles y estado de las cuentas. Las acciones quedan auditadas en el servidor.'
              : 'Perfil, preferencias, seguridad, sesiones y facturación de tu cuenta.'}
          </p>
        </div>
      </div>
      <Tabs value={tab} onValueChange={(value) => setTab(value as SubVista)}>
        <TabsList className="mb-4 h-auto justify-start gap-1 bg-transparent p-0 max-[760px]:grid max-[760px]:h-auto! max-[760px]:w-full max-[760px]:grid-cols-3 max-[360px]:grid-cols-2">
          {PESTANAS.filter((p) => p.id !== 'admin' || esAdmin).map((p) => (
            <TabsTrigger
              key={p.id}
              value={p.id}
              className="h-9 px-3 data-active:bg-card data-active:shadow-sm max-[760px]:w-full"
            >
              {p.titulo}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="perfil" className="space-y-4">
          <Perfil me={me} onMe={onMe} />
          <Datos me={me} onSesionCerrada={onSesionCerrada} />
        </TabsContent>
        <TabsContent value="preferencias">
          <PreferenciasView onPrefs={onPrefs} />
        </TabsContent>
        <TabsContent value="seguridad">
          <Seguridad onSesionCerrada={onSesionCerrada} />
        </TabsContent>
        <TabsContent value="sesiones">
          <Sesiones onSesionCerrada={onSesionCerrada} />
        </TabsContent>
        <TabsContent value="facturacion">
          <Facturacion />
        </TabsContent>
        <TabsContent value="admin">
          {esAdmin ? (
            <AdminPanel />
          ) : (
            <p className="text-sm text-destructive" role="alert">
              Sin permiso: esta sección es solo para administradores.
            </p>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
