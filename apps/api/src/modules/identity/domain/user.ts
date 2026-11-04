// Entidad User: identidad + estado + transiciones. Sin Nest/SQL/HTTP.
import { parseDisplayName, parseEmail } from './value-objects';

export type UserStatus = 'active' | 'disabled' | 'deleted';
export type UserRole = 'user' | 'admin';

export interface UserProps {
  id: string;
  email: string;
  displayName: string;
  passwordHash: string;
  emailVerifiedAt: Date | null;
  status: UserStatus;
  role: UserRole;
  createdAt: Date;
  updatedAt: Date;
}

export interface NewUserProps {
  id: string;
  email: string;
  displayName: string;
  passwordHash: string;
  now: Date;
}

export class User {
  private constructor(private p: UserProps) {}

  static create(n: NewUserProps): User {
    return new User({
      id: n.id,
      email: parseEmail(n.email),
      displayName: parseDisplayName(n.displayName),
      passwordHash: n.passwordHash,
      emailVerifiedAt: null,
      status: 'active',
      role: 'user',
      createdAt: n.now,
      updatedAt: n.now,
    });
  }

  static rehydrate(p: UserProps): User {
    return new User({ ...p });
  }

  get snapshot(): UserProps {
    return { ...this.p };
  }

  get id(): string {
    return this.p.id;
  }

  get email(): string {
    return this.p.email;
  }

  get role(): UserRole {
    return this.p.role;
  }

  get status(): UserStatus {
    return this.p.status;
  }

  get emailVerified(): boolean {
    return this.p.emailVerifiedAt !== null;
  }

  /** Solo cuentas activas y no borradas pueden autenticarse. */
  canAuthenticate(): boolean {
    return this.p.status === 'active';
  }

  verifyEmail(now: Date): void {
    if (this.p.emailVerifiedAt) return;
    this.p.emailVerifiedAt = now;
    this.p.updatedAt = now;
  }

  setPasswordHash(hash: string, now: Date): void {
    this.p.passwordHash = hash;
    this.p.updatedAt = now;
  }

  setDisplayName(name: string, now: Date): void {
    this.p.displayName = parseDisplayName(name);
    this.p.updatedAt = now;
  }

  /** Cambio de correo ya verificado (la nueva dirección se marcó verified). */
  setEmail(email: string, now: Date): void {
    this.p.email = parseEmail(email);
    this.p.emailVerifiedAt = now;
    this.p.updatedAt = now;
  }

  disable(now: Date): void {
    this.p.status = 'disabled';
    this.p.updatedAt = now;
  }

  enable(now: Date): void {
    if (this.p.status === 'deleted') return; // borrado no reversible por admin
    this.p.status = 'active';
    this.p.updatedAt = now;
  }

  setRole(role: UserRole, now: Date): void {
    this.p.role = role;
    this.p.updatedAt = now;
  }

  markDeleted(now: Date): void {
    this.p.status = 'deleted';
    this.p.updatedAt = now;
  }
}
