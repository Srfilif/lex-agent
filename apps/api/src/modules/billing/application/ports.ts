// Puerto de proveedor de pagos: el dominio no conoce Sandbox ni Wompi.
// Un adaptador futuro (Wompi) implementa esta misma interfaz.
export const PAYMENT_PROVIDER = Symbol('PAYMENT_PROVIDER');

export interface CheckoutRequest {
  userId: string;
  planCode: string;
  amountMinor: number;
  currency: string;
}

export interface CheckoutResult {
  providerPaymentId: string;
  /** URL (relativa en sandbox) donde el usuario completa/simula el pago. */
  checkoutUrl: string;
  amountMinor: number;
  currency: string;
}

export type ProviderEventType = 'payment.succeeded' | 'payment.failed' | 'refund.succeeded';

export interface ProviderEvent {
  providerEventId: string;
  type: ProviderEventType;
  providerPaymentId: string;
  amountMinor: number;
  currency: string;
  occurredAt: Date;
  metadata: { userId: string; planCode: string };
}

export interface PaymentProvider {
  readonly name: string;
  /** Cabecera HTTP donde llega la firma del webhook. */
  readonly signatureHeader: string;
  createCheckout(r: CheckoutRequest): Promise<CheckoutResult>;
  /** HMAC/firma oficial del proveedor sobre el cuerpo crudo. */
  verifyWebhook(rawBody: Buffer, signature: string): boolean;
  /** Valida forma del evento (lanza 400 si malformado). */
  parseEvent(payload: unknown): ProviderEvent;
}

/** Contrato de facturación publicado a chat y research. */
export const AGENT_BILLING = Symbol('AGENT_BILLING');

export interface AgentBillingPort {
  reserveInvestigation(userId: string): Promise<{ maxPasos: number; restantes: number }>;
  recordInvestigation(
    userId: string,
    investigacionId: string,
    tokensIn: number,
    tokensOut: number,
    costUsd: number,
  ): Promise<void>;
  reserveChat(userId: string): Promise<{ modelos: string[]; tokensRestantes: number }>;
  recordChat(
    userId: string,
    messageId: string,
    tokensIn: number,
    tokensOut: number,
    costUsd: number,
  ): Promise<void>;
  recordAux(
    userId: string,
    kind: 'titulo' | 'sugerencias',
    idempotencyKey: string,
    refId: string,
    tokensIn: number,
    tokensOut: number,
    costUsd: number,
  ): Promise<void>;
  recordAbstencion(userId: string, messageId: string): Promise<void>;
  recordVerification(
    userId: string,
    investigacionId: string,
    tokensIn: number,
    tokensOut: number,
    costUsd: number,
  ): Promise<void>;
}

/** Construcción de eventos firmados (solo la implementa el sandbox). */
export interface SandboxEventBuilder {
  buildEvent(
    type: ProviderEventType,
    args: {
      providerPaymentId: string;
      amountMinor: number;
      currency: string;
      userId: string;
      planCode: string;
    },
  ): { payload: Record<string, unknown>; signature: string };
}
