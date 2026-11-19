import { useEffect, useMemo, useState } from 'react';
import {
  Bell,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ChevronsUpDown,
  CircleAlert,
  FileSearch,
  FolderOpen,
  Home,
  LogOut,
  Menu,
  MessageSquare,
  Moon,
  PanelLeft,
  Plus,
  RefreshCw,
  Search,
  Settings,
  Settings2,
  ShieldCheck,
  Sun,
  UserRound,
  X,
} from 'lucide-react';
import { AuthHttpError, mensajeError } from '../auth';
import { api } from '../api';
import { searchChat, type SearchHit } from '../chatApi';
import type { Me } from '../cuenta';
import type { SubVista } from './Cuenta';
import { Avatar, AvatarFallback } from './ui/avatar';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from './ui/command';
import { Brand } from './Logo';

export type Vista =
  | 'inicio'
  | 'chat'
  | 'investigar'
  | 'biblioteca'
  | 'storage'
  | 'cuenta'
  | 'admin';

const TITULOS: Record<Vista, string> = {
  inicio: 'Inicio',
  chat: 'Asistente jurídico',
  investigar: 'Investigación',
  biblioteca: 'Biblioteca jurídica',
  storage: 'Documentos',
  cuenta: 'Cuenta',
  admin: 'Administración',
};

interface Comando {
  id: string;
  titulo: string;
  detalle: string;
  vista?: Vista;
}

const COMANDOS: Comando[] = [
  { id: 'nav-inicio', titulo: 'Ir al inicio', detalle: 'Panel general', vista: 'inicio' },
  {
    id: 'nav-chat',
    titulo: 'Abrir asistente jurídico',
    detalle: 'Chat con fuentes verificables',
    vista: 'chat',
  },
  {
    id: 'nav-investigar',
    titulo: 'Nueva investigación',
    detalle: 'Informe estructurado con verificación de citas',
    vista: 'investigar',
  },
  {
    id: 'nav-biblioteca',
    titulo: 'Explorar biblioteca',
    detalle: 'Documentos y fragmentos del corpus',
    vista: 'biblioteca',
  },
  {
    id: 'nav-storage',
    titulo: 'Ver documentos',
    detalle: 'Archivos cargados en tus proyectos',
    vista: 'storage',
  },
];

function iniciales(email: string | null, nombre: string | null): string {
  const base = (nombre || email || 'L').trim();
  const partes = base.replace(/@.*/, '').split(/[\s._-]+/).filter(Boolean);
  if (partes.length >= 2) return `${partes[0][0]}${partes[1][0]}`;
  return base.slice(0, 2);
}

export default function AppShell({
  vista,
  onVista,
  me,
  email,
  theme,
  onToggleTheme,
  onLogout,
  onNewChat,
  onOpenChat,
  onCuenta,
  children,
}: {
  vista: Vista;
  onVista: (v: Vista) => void;
  me: Me | null;
  email: string | null;
  theme: 'light' | 'dark' | 'system';
  onToggleTheme: () => void;
  onLogout: () => void;
  onNewChat: () => void;
  onOpenChat: (conversationId: string) => void;
  onCuenta: (tab?: SubVista) => void;
  children: React.ReactNode;
}): React.ReactElement {
  const [railOpen, setRailOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [salud, setSalud] = useState<'ok' | 'degraded' | 'offline'>('ok');
  const [revisandoSalud, setRevisandoSalud] = useState(false);

  useEffect(() => {
    let vivo = true;
    api.health().then(
      (h) => {
        if (vivo) setSalud(h.status === 'ok' ? 'ok' : 'degraded');
      },
      () => {
        if (vivo) setSalud('offline');
      },
    );
    return () => {
      vivo = false;
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    setRailOpen(false);
  }, [vista]);

  const esAdmin = me?.role === 'admin';
  const nombre = me?.display_name ?? null;

  function ir(v: Vista): void {
    onVista(v);
    setRailOpen(false);
  }

  function irCuenta(tab: SubVista = 'perfil'): void {
    onCuenta(tab);
    setRailOpen(false);
  }

  function revisarSalud(): void {
    setRevisandoSalud(true);
    api.health()
      .then((h) => setSalud(h.status === 'ok' ? 'ok' : 'degraded'))
      .catch(() => setSalud('offline'))
      .finally(() => setRevisandoSalud(false));
  }

  return (
    <div className={`app${collapsed ? ' rail-collapsed' : ''}`}>
      {railOpen && (
        <button
          type="button"
          className="rail-overlay bg-black/45 hover:bg-black/45"
          aria-label="Cerrar navegación"
          onClick={() => setRailOpen(false)}
        />
      )}
      <aside className={`rail${railOpen ? ' abierto' : ''}`} aria-label="Navegación principal">
        <div className="brand">
          <Brand />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="ml-auto md:hidden"
            onClick={() => setRailOpen(false)}
            aria-label="Cerrar navegación"
          >
            <X />
          </Button>
          <button
            type="button"
            className="rail-toggle hide-mobile"
            onClick={() => setCollapsed((v) => !v)}
            aria-label={collapsed ? 'Expandir navegación' : 'Contraer navegación'}
            title={collapsed ? 'Expandir navegación' : 'Contraer navegación'}
          >
            <PanelLeft size={14} />
          </button>
        </div>

        <div className="rail-actions">
          <Button type="button" className="rail-new w-full justify-center gap-1.5" onClick={onNewChat}>
            <Plus />
            <span className="max-[1000px]:hidden max-[760px]:inline">Nueva consulta</span>
          </Button>
          <Button
            type="button"
            variant="outline"
            className={`rail-search h-9 w-full gap-2 border-border bg-card font-normal text-muted-foreground shadow-none hover:bg-muted hover:text-foreground ${
              collapsed
                ? 'justify-center px-0'
                : 'justify-start px-2.5 max-[1000px]:justify-center max-[1000px]:px-0 max-[760px]:justify-start max-[760px]:px-2.5'
            }`}
            onClick={() => setSearchOpen(true)}
            aria-label="Buscar en la plataforma (Ctrl+K)"
            aria-keyshortcuts="Control+K Meta+K"
            title="Buscar (Ctrl+K)"
          >
            <Search className="size-4 shrink-0" />
            <span
              className={`rail-search-label flex-1 truncate text-left ${
                collapsed ? 'hidden' : 'max-[1000px]:hidden max-[760px]:block'
              }`}
            >
              Buscar
            </span>
            <kbd
              className={`rail-search-kbd rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground ${
                collapsed ? 'hidden' : 'max-[1000px]:hidden max-[760px]:inline-flex'
              }`}
            >
              Ctrl K
            </kbd>
          </Button>
        </div>

        <nav className="rail-nav" aria-label="Secciones">
          <div className="rail-group">
            <span className="rail-label">Trabajo</span>
            <button
              type="button"
              className={`rail-item${vista === 'inicio' ? ' activo' : ''}`}
              onClick={() => ir('inicio')}
              title="Inicio"
            >
              <Home size={18} />
              <span>Inicio</span>
            </button>
            <button
              type="button"
              className={`rail-item${vista === 'chat' ? ' activo' : ''}`}
              onClick={() => ir('chat')}
              title="Asistente jurídico"
            >
              <MessageSquare size={18} />
              <span>Asistente</span>
            </button>
            <button
              type="button"
              className={`rail-item${vista === 'investigar' ? ' activo' : ''}`}
              onClick={() => ir('investigar')}
              title="Investigación jurídica"
            >
              <FileSearch size={18} />
              <span>Investigación</span>
            </button>
          </div>

          <div className="rail-group">
            <span className="rail-label">Conocimiento</span>
            <button
              type="button"
              className={`rail-item${vista === 'biblioteca' ? ' activo' : ''}`}
              onClick={() => ir('biblioteca')}
              title="Biblioteca jurídica"
            >
              <BookOpen size={18} />
              <span>Biblioteca</span>
            </button>
            <button
              type="button"
              className={`rail-item${vista === 'storage' ? ' activo' : ''}`}
              onClick={() => ir('storage')}
              title="Documentos"
            >
              <FolderOpen size={18} />
              <span>Documentos</span>
            </button>
          </div>

          <div className="rail-group">
            <span className="rail-label">Cuenta</span>
            <button
              type="button"
              className={`rail-item${vista === 'cuenta' ? ' activo' : ''}`}
              onClick={() => irCuenta('perfil')}
              title="Cuenta y preferencias"
            >
              <Settings size={18} />
              <span>Configuración</span>
            </button>
            {esAdmin && (
              <button
                type="button"
                className={`rail-item${vista === 'admin' ? ' activo' : ''}`}
                onClick={() => ir('admin')}
                title="Administración"
              >
                <ShieldCheck size={18} />
                <span>Administración</span>
              </button>
            )}
          </div>
        </nav>

        <div className="rail-footer">
          <MenuPerfil
            nombre={nombre}
            email={email}
            esAdmin={esAdmin}
            theme={theme}
            onCuenta={irCuenta}
            onAdmin={() => ir('admin')}
            onToggleTheme={onToggleTheme}
            onLogout={onLogout}
            side="top"
            align="start"
            className="w-[15.5rem]"
          >
            <button
              type="button"
              className="rail-user w-full"
              aria-label="Abrir menú de cuenta"
              title="Tu cuenta"
            >
              <Avatar className="size-8 border border-primary/20" aria-hidden="true">
                <AvatarFallback className="bg-primary/10 text-[11px] font-bold text-primary">
                  {iniciales(email, nombre)}
                </AvatarFallback>
              </Avatar>
              <span className="rail-user-info">
                <strong>{nombre || 'Mi cuenta'}</strong>
                <span>{email ?? ''}</span>
              </span>
              <ChevronsUpDown
                className={`rail-user-chevron ml-auto size-3.5 shrink-0 text-muted-foreground ${
                  collapsed ? 'hidden' : 'max-[1000px]:hidden max-[760px]:block'
                }`}
              />
            </button>
          </MenuPerfil>
        </div>
      </aside>

      <div className="app-body">
        <header className="topbar">
          <div className="topbar-left">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="md:hidden"
              onClick={() => setRailOpen(true)}
              aria-label="Abrir navegación"
            >
              <Menu />
            </Button>
            <div className="crumbs" aria-label="Ubicación">
              <span className="max-[520px]:hidden">Kelsyx</span>
              <ChevronRight size={13} className="max-[520px]:hidden" />
              <strong>{TITULOS[vista]}</strong>
            </div>
          </div>
          <div className="topbar-right">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-10"
              onClick={onToggleTheme}
              aria-label={theme === 'dark' ? 'Activar tema claro' : 'Activar tema oscuro'}
              title={theme === 'dark' ? 'Tema claro' : 'Tema oscuro'}
            >
              {theme === 'dark' ? <Sun className="size-6" /> : <Moon className="size-6" />}
            </Button>
            <MenuNotificaciones
              salud={salud}
              revisando={revisandoSalud}
              onReintentar={revisarSalud}
              onPreferencias={() => irCuenta('preferencias')}
            />
            <MenuPerfil
              nombre={nombre}
              email={email}
              esAdmin={esAdmin}
              theme={theme}
              onCuenta={irCuenta}
              onAdmin={() => ir('admin')}
              onToggleTheme={onToggleTheme}
              onLogout={onLogout}
              align="end"
              className="w-64"
            >
              <Button
                type="button"
                variant="ghost"
                className="h-10 gap-1 rounded-full py-1 pr-2 pl-1"
                aria-label="Abrir menú de cuenta"
                title="Tu cuenta"
              >
                <Avatar className="size-8 border border-primary/20" aria-hidden="true">
                  <AvatarFallback className="bg-primary/10 text-[11px] font-bold text-primary">
                    {iniciales(email, nombre)}
                  </AvatarFallback>
                </Avatar>
                <ChevronDown className="size-4 text-muted-foreground" />
                <span className="sr-only">Abrir menú de cuenta</span>
              </Button>
            </MenuPerfil>
          </div>
        </header>
        <main id="contenido" tabIndex={-1} style={{ outline: 'none', flex: 1 }}>
          {children}
        </main>
      </div>

      {searchOpen && (
        <BuscadorGlobal
          onClose={() => setSearchOpen(false)}
          onVista={(v) => {
            setSearchOpen(false);
            onVista(v);
          }}
          onConversacion={(id) => {
            setSearchOpen(false);
            onOpenChat(id);
          }}
          onNuevaConsulta={() => {
            setSearchOpen(false);
            onNewChat();
          }}
        />
      )}
    </div>
  );
}

function MenuNotificaciones({
  salud,
  revisando,
  onReintentar,
  onPreferencias,
}: {
  salud: 'ok' | 'degraded' | 'offline';
  revisando: boolean;
  onReintentar: () => void;
  onPreferencias: () => void;
}): React.ReactElement {
  const conAviso = salud !== 'ok';
  const estado = salud === 'ok' ? 'operativo' : salud === 'degraded' ? 'degradado' : 'sin conexión';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="relative size-10"
          aria-label={conAviso ? 'Notificaciones: 1 aviso' : 'Notificaciones'}
          title="Notificaciones"
        >
          <Bell className="size-6" />
          {conAviso && (
            <span
              className="absolute top-1.5 right-1.5 size-1.5 rounded-full bg-destructive ring-2 ring-background"
              aria-hidden="true"
            />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        sideOffset={8}
        className="z-[70] w-[21rem] max-w-[calc(100vw-1.5rem)] p-0"
      >
        <div className="flex items-start justify-between gap-3 border-b border-border px-3 py-2.5">
          <div>
            <p className="text-sm font-semibold">Notificaciones</p>
            <p className="text-xs text-muted-foreground">Seguridad y estado del servicio</p>
          </div>
          <Badge
            variant={conAviso ? 'destructive' : 'secondary'}
            className="mt-0.5 h-5 px-1.5 text-[10px] font-medium"
          >
            {conAviso ? '1 aviso' : 'Al día'}
          </Badge>
        </div>

        {conAviso ? (
          <div className="px-3 py-3">
            <div className="flex items-start gap-2.5">
              <span className="grid size-8 shrink-0 place-items-center rounded-full bg-destructive/10 text-destructive">
                <CircleAlert className="size-4" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-medium">
                  {salud === 'offline' ? 'Sin conexión con el servicio' : 'Servicio en modo degradado'}
                </p>
                <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                  {salud === 'offline'
                    ? 'No pudimos conectar con la API. Revisa tu conexión o inténtalo de nuevo.'
                    : 'Algunas funciones pueden tardar más de lo habitual mientras se recupera el servicio.'}
                </p>
              </div>
            </div>
            <DropdownMenuItem
              disabled={revisando}
              className="mt-2 gap-2 text-xs"
              onSelect={(e) => {
                e.preventDefault();
                onReintentar();
              }}
            >
              <RefreshCw className={revisando ? 'animate-spin' : ''} />
              {revisando ? 'Comprobando…' : 'Reintentar ahora'}
            </DropdownMenuItem>
          </div>
        ) : (
          <div className="flex flex-col items-center px-4 py-6 text-center">
            <span className="grid size-9 place-items-center rounded-full bg-muted text-muted-foreground">
              <CheckCircle2 className="size-4" />
            </span>
            <p className="mt-2 text-sm font-medium">Estás al día</p>
            <p className="mt-0.5 max-w-[17rem] text-xs leading-relaxed text-muted-foreground">
              No tienes notificaciones nuevas. Aquí verás alertas de seguridad y actividad relevante de
              tu cuenta.
            </p>
          </div>
        )}

        <DropdownMenuSeparator className="mx-0 my-0" />
        <div className="flex items-center gap-2 px-3 py-2 text-[11px] text-muted-foreground">
          <span
            className={`status-dot${salud === 'degraded' ? ' warn' : salud === 'offline' ? ' bad' : ''}`}
          />
          <span>Servicio {estado}</span>
        </div>
        <DropdownMenuSeparator className="mx-0 my-0" />
        <div className="p-1">
          <DropdownMenuItem className="gap-2" onSelect={onPreferencias}>
            <Settings2 />
            Preferencias de notificaciones
          </DropdownMenuItem>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function MenuPerfil({
  children,
  nombre,
  email,
  esAdmin,
  theme,
  onCuenta,
  onAdmin,
  onToggleTheme,
  onLogout,
  side = 'bottom',
  align = 'end',
  className,
}: {
  children: React.ReactElement;
  nombre: string | null;
  email: string | null;
  esAdmin: boolean;
  theme: 'light' | 'dark' | 'system';
  onCuenta: (tab?: SubVista) => void;
  onAdmin: () => void;
  onToggleTheme: () => void;
  onLogout: () => void;
  side?: 'top' | 'right' | 'bottom' | 'left';
  align?: 'start' | 'center' | 'end';
  className?: string;
}): React.ReactElement {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{children}</DropdownMenuTrigger>
      <DropdownMenuContent
        side={side}
        align={align}
        sideOffset={8}
        className={`z-[70] ${className ?? ''}`}
      >
        <DropdownMenuLabel className="px-2 py-2 font-normal">
          <span className="flex items-center gap-2">
            <Avatar className="size-8 border border-primary/20" aria-hidden="true">
              <AvatarFallback className="bg-primary/10 text-[11px] font-bold text-primary">
                {iniciales(email, nombre)}
              </AvatarFallback>
            </Avatar>
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold text-foreground">
                {nombre || 'Tu cuenta'}
              </span>
              {email && (
                <span className="block truncate text-xs font-normal text-muted-foreground">
                  {email}
                </span>
              )}
            </span>
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="gap-2" onSelect={() => onCuenta('perfil')}>
          <UserRound />
          Mi cuenta
        </DropdownMenuItem>
        <DropdownMenuItem className="gap-2" onSelect={() => onCuenta('preferencias')}>
          <Settings2 />
          Preferencias
        </DropdownMenuItem>
        {esAdmin && (
          <DropdownMenuItem className="gap-2" onSelect={onAdmin}>
            <ShieldCheck />
            Administración
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem className="gap-2" onSelect={onToggleTheme}>
          {theme === 'dark' ? <Sun /> : <Moon />}
          {theme === 'dark' ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" className="gap-2" onSelect={onLogout}>
          <LogOut />
          Cerrar sesión
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function BuscadorGlobal({
  onClose,
  onVista,
  onConversacion,
  onNuevaConsulta,
}: {
  onClose: () => void;
  onVista: (v: Vista) => void;
  onConversacion: (id: string) => void;
  onNuevaConsulta: () => void;
}): React.ReactElement {
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) {
      setHits([]);
      setError('');
      return;
    }
    let vivo = true;
    setCargando(true);
    const t = window.setTimeout(() => {
      void searchChat(term, 8)
        .then((r) => {
          if (vivo) {
            setHits(r.hits);
            setError('');
          }
        })
        .catch((e: unknown) => {
          if (!vivo) return;
          setHits([]);
          setError(
            e instanceof AuthHttpError
              ? mensajeError(e.status, e.message)
              : 'No se pudo buscar en tus conversaciones.',
          );
        })
        .finally(() => {
          if (vivo) setCargando(false);
        });
    }, 260);
    return () => {
      vivo = false;
      window.clearTimeout(t);
    };
  }, [q]);

  const comandos = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return COMANDOS;
    return COMANDOS.filter(
      (c) => c.titulo.toLowerCase().includes(term) || c.detalle.toLowerCase().includes(term),
    );
  }, [q]);

  return (
    <CommandDialog
      open
      onOpenChange={(abierto) => {
        if (!abierto) onClose();
      }}
      title="Buscador global"
      description="Busca conversaciones o navega a una sección de la plataforma."
      className="top-[12vh] max-h-[74vh] translate-y-0 sm:max-w-[620px]"
    >
      <CommandInput
        autoFocus
        value={q}
        onValueChange={setQ}
        placeholder="Buscar conversaciones o ir a una sección…"
        aria-label="Buscar"
      />
      <CommandList className="max-h-[54vh]">
        <CommandEmpty>Sin coincidencias.</CommandEmpty>
        <CommandGroup heading="Acciones">
          <CommandItem value="nueva consulta" onSelect={onNuevaConsulta}>
            <Plus />
            <span className="flex min-w-0 flex-col">
              <strong className="font-medium">Nueva consulta</strong>
              <span className="text-xs text-muted-foreground">
                Abrir el asistente con una conversación en blanco
              </span>
            </span>
            <CommandShortcut>Enter</CommandShortcut>
          </CommandItem>
          {comandos.map((c) => (
            <CommandItem
              key={c.id}
              value={`${c.titulo} ${c.detalle}`}
              onSelect={() => c.vista && onVista(c.vista)}
            >
              <ChevronRight />
              <span className="flex min-w-0 flex-col">
                <strong className="font-medium">{c.titulo}</strong>
                <span className="text-xs text-muted-foreground">{c.detalle}</span>
              </span>
            </CommandItem>
          ))}
        </CommandGroup>
        {q.trim().length >= 2 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Tus conversaciones">
              {cargando && (
                <div className="px-2 py-2 text-xs text-muted-foreground">Buscando…</div>
              )}
              {!cargando && error && (
                <div className="px-2 py-2 text-xs text-destructive">{error}</div>
              )}
              {!cargando && !error && hits.length === 0 && (
                <div className="px-2 py-2 text-xs text-muted-foreground">
                  Sin coincidencias en tus conversaciones.
                </div>
              )}
              {hits.map((h) => (
                <CommandItem
                  key={h.message_id}
                  value={`${h.title ?? ''} ${h.snippet ?? ''}`}
                  onSelect={() => onConversacion(h.conversation_id)}
                >
                  <MessageSquare />
                  <span className="flex min-w-0 flex-col">
                    <strong className="font-medium">{h.title || 'Sin título'}</strong>
                    <span className="line-clamp-1 text-xs text-muted-foreground">
                      {h.snippet}
                    </span>
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
}
