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
  termsVersion: string | null;
  termsAcceptedAt: Date | null;
  privacyVersion: string | null;
  privacyAcceptedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ConsentVersions {
  termsVersion: string;
  privacyVersion: string;
}

export interface NewUserProps {
  id: string;
  email: string;
  displayName: string;
  passwordHash: string;
  now: Date;
  /** Versiones aceptadas en el registro; ausente en cuentas previas a 019. */
  consent?: ConsentVersions | null;
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
      termsVersion: n.consent?.termsVersion ?? null,
      termsAcceptedAt: n.consent ? n.now : null,
      privacyVersion: n.consent?.privacyVersion ?? null,
      privacyAcceptedAt: n.consent ? n.now : null,
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

  /** Aceptación (o re-aceptación) de términos + autorización de datos. */
  recordConsent(termsVersion: string, privacyVersion: string, now: Date): void {
    this.p.termsVersion = termsVersion;
    this.p.termsAcceptedAt = now;
    this.p.privacyVersion = privacyVersion;
    this.p.privacyAcceptedAt = now;
    this.p.updatedAt = now;
  }

  /** Ambas aceptaciones presentes (términos y datos son independientes). */
  get consentsComplete(): boolean {
    return (
      this.p.termsVersion !== null &&
      this.p.termsAcceptedAt !== null &&
      this.p.privacyVersion !== null &&
      this.p.privacyAcceptedAt !== null
    );
  }
}
