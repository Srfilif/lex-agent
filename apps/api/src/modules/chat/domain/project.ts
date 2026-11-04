// Dominio B5/B9: proyectos (nombre + instrucciones) y enlaces compartidos.
// Puro: sin Nest/SQL/HTTP. El token se genera en aplicación (crypto).
export interface ProjectProps {
  id: string;
  userId: string;
  name: string;
  instructions: string;
  createdAt: Date;
  updatedAt: Date;
}

export class Project {
  private constructor(private p: ProjectProps) {}

  static rehydrate(p: ProjectProps): Project {
    return new Project({ ...p });
  }

  get snapshot(): ProjectProps {
    return { ...this.p };
  }

  get id(): string {
    return this.p.id;
  }

  get userId(): string {
    return this.p.userId;
  }

  rename(name: string, now: Date): void {
    const t = name.trim().replace(/\s+/g, ' ').slice(0, 120);
    if (!t) throw new Error('nombre vacío');
    this.p.name = t;
    this.p.updatedAt = now;
  }

  setInstructions(instructions: string, now: Date): void {
    // Instrucciones del proyecto: contexto persistente para el agente.
    this.p.instructions = instructions.trim().slice(0, 4000);
    this.p.updatedAt = now;
  }
}

export interface ShareLinkProps {
  id: string;
  conversationId: string;
  token: string;
  createdAt: Date;
  revokedAt: Date | null;
}

export function shareActiva(s: ShareLinkProps): boolean {
  return s.revokedAt === null;
}
