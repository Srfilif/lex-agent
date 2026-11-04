// Entidad AuthSession: refresh opaco rotatorio + familia + revocación.
// Reglas: caducidad absoluta (expiresAt), inactividad (lastSeenAt),
// revocación con motivo, rotación que encadena prevHash.

export interface SessionProps {
  id: string;
  userId: string;
  refreshHash: string;
  family: string;
  prevHash: string | null;
  createdAt: Date;
  lastSeenAt: Date;
  expiresAt: Date;
  revokedAt: Date | null;
  revokeReason: string | null;
  deviceLabel: string | null;
  userAgent: string | null;
  ip: string | null;
  /** I2 (017): true solo si la sesión nació tras verificar MFA. */
  mfaOk: boolean;
}

export interface NewSessionProps {
  id: string;
  userId: string;
  refreshHash: string;
  family: string;
  expiresAt: Date;
  now: Date;
  deviceLabel?: string | null;
  userAgent?: string | null;
  ip?: string | null;
  mfaOk?: boolean;
}

export class AuthSession {
  private constructor(private p: SessionProps) {}

  static create(n: NewSessionProps): AuthSession {
    return new AuthSession({
      id: n.id,
      userId: n.userId,
      refreshHash: n.refreshHash,
      family: n.family,
      prevHash: null,
      createdAt: n.now,
      lastSeenAt: n.now,
      expiresAt: n.expiresAt,
      revokedAt: null,
      revokeReason: null,
      deviceLabel: n.deviceLabel ?? null,
      userAgent: n.userAgent ?? null,
      ip: n.ip ?? null,
      mfaOk: n.mfaOk ?? false,
    });
  }

  static rehydrate(p: SessionProps): AuthSession {
    return new AuthSession({ ...p });
  }

  get snapshot(): SessionProps {
    return { ...this.p };
  }

  get id(): string {
    return this.p.id;
  }

  get userId(): string {
    return this.p.userId;
  }

  get family(): string {
    return this.p.family;
  }

  get refreshHash(): string {
    return this.p.refreshHash;
  }

  get revoked(): boolean {
    return this.p.revokedAt !== null;
  }

  get mfaOk(): boolean {
    return this.p.mfaOk;
  }

  isExpired(now: Date): boolean {
    return this.p.expiresAt.getTime() <= now.getTime();
  }

  isStale(now: Date, inactivityMs: number): boolean {
    return now.getTime() - this.p.lastSeenAt.getTime() > inactivityMs;
  }

  isActive(now: Date, inactivityMs: number): boolean {
    return !this.revoked && !this.isExpired(now) && !this.isStale(now, inactivityMs);
  }

  touch(now: Date): void {
    this.p.lastSeenAt = now;
  }

  revoke(now: Date, reason: string): void {
    if (this.p.revokedAt) return;
    this.p.revokedAt = now;
    this.p.revokeReason = reason;
  }

  /**
   * Rotación: esta sesión queda revocada ('rotada') y nace la siguiente
   * en la misma familia, conservando la caducidad absoluta original.
   */
  rotate(now: Date, nextId: string, nextRefreshHash: string): AuthSession {
    this.revoke(now, 'rotada');
    return new AuthSession({
      id: nextId,
      userId: this.p.userId,
      refreshHash: nextRefreshHash,
      family: this.p.family,
      prevHash: this.p.refreshHash,
      createdAt: now,
      lastSeenAt: now,
      expiresAt: this.p.expiresAt,
      revokedAt: null,
      revokeReason: null,
      deviceLabel: this.p.deviceLabel,
      userAgent: this.p.userAgent,
      ip: this.p.ip,
      mfaOk: this.p.mfaOk, // la rotación conserva el nivel MFA de la familia
    });
  }
}
