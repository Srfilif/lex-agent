// Consentimientos legales: lectura y (re-)aceptación de términos + datos.
// Cuentas creadas antes de la migración 019 llegan sin consentimiento y deben
// aceptarlo al siguiente inicio de sesión (ConsentGate en el frontend).
import { Inject, Injectable } from '@nestjs/common';
import {
  CURRENT_PRIVACY_VERSION,
  CURRENT_TERMS_VERSION,
  noEncontrado,
  operacionNoPermitida,
  RequestMeta,
  SECURITY_EVENT_REPOSITORY,
  SecurityEventRepository,
  USER_REPOSITORY,
  UserRepository,
} from '../../identity';

export interface ConsentState {
  terms_version: string | null;
  terms_accepted_at: string | null;
  privacy_version: string | null;
  privacy_accepted_at: string | null;
  complete: boolean;
  current_terms_version: string;
  current_privacy_version: string;
}

@Injectable()
export class Consents {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(SECURITY_EVENT_REPOSITORY) private readonly events: SecurityEventRepository,
  ) {}

  async get(userId: string): Promise<ConsentState> {
    const user = await this.users.findById(userId);
    if (!user) throw noEncontrado('cuenta no encontrada');
    return this.stateOf(user.snapshot);
  }

  async accept(
    userId: string,
    input: { termsAccepted: boolean; privacyAccepted: boolean },
    meta: RequestMeta,
  ): Promise<ConsentState> {
    if (input.termsAccepted !== true || input.privacyAccepted !== true) {
      throw operacionNoPermitida('debe aceptar los términos y autorizar el tratamiento de datos');
    }
    const user = await this.users.findById(userId);
    if (!user) throw noEncontrado('cuenta no encontrada');
    const now = new Date();
    user.recordConsent(CURRENT_TERMS_VERSION, CURRENT_PRIVACY_VERSION, now);
    await this.users.update(user);
    await this.events.record({
      userId,
      type: 'consentimiento_registrado',
      success: true,
      ip: meta.ip,
      userAgent: meta.userAgent,
      meta: { terms: CURRENT_TERMS_VERSION, privacy: CURRENT_PRIVACY_VERSION },
    });
    return this.stateOf(user.snapshot);
  }

  private stateOf(p: {
    termsVersion: string | null;
    termsAcceptedAt: Date | null;
    privacyVersion: string | null;
    privacyAcceptedAt: Date | null;
  }): ConsentState {
    const complete =
      p.termsVersion !== null &&
      p.termsAcceptedAt !== null &&
      p.privacyVersion !== null &&
      p.privacyAcceptedAt !== null;
    return {
      terms_version: p.termsVersion,
      terms_accepted_at: p.termsAcceptedAt ? p.termsAcceptedAt.toISOString() : null,
      privacy_version: p.privacyVersion,
      privacy_accepted_at: p.privacyAcceptedAt ? p.privacyAcceptedAt.toISOString() : null,
      complete,
      current_terms_version: CURRENT_TERMS_VERSION,
      current_privacy_version: CURRENT_PRIVACY_VERSION,
    };
  }
}
