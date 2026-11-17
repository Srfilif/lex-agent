import { VerificationResult } from '../domain/verdict';

export const VERIFICATION_PORT = Symbol('VERIFICATION_PORT');

export interface VerificarInvestigacion {
  verificar(investigacionId: string): Promise<VerificationResult>;
}
