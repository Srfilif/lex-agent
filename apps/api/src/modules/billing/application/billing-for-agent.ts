// Fachada de consumo para el agente/verificador (Fase E).
// Reserva pre-vuelo (compuerta dura, 429) + registro post-vuelo (medición).
// Anónimos: el llamador no invoca la fachada (legacy sin cambios).
import { Inject, Injectable } from '@nestjs/common';
import { TOKEN_GENERATOR, TokenGenerator, USER_REPOSITORY, UserRepository } from '../../identity';
import { intEntitlement, modelosPermitidos } from '../domain/plan';
import { USAGE_REPOSITORY, UsageRepository } from '../domain/repositories';
import { periodKey } from '../domain/usage';
import { EffectivePlanResolver } from './effective-plan';
import { cuotaAgotada } from './errors';

@Injectable()
export class BillingForAgent {
  constructor(
    private readonly effective: EffectivePlanResolver,
    @Inject(USAGE_REPOSITORY) private readonly usage: UsageRepository,
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(TOKEN_GENERATOR) private readonly gen: TokenGenerator,
  ) {}

  /**
   * Reserva 1 investigación (atómico). Lanza cuotaAgotada (429) si no cabe.
   * Devuelve tope de pasos del plan y restantes (para clamp + respuesta).
   */
  async reserveInvestigation(
    userId: string,
  ): Promise<{ maxPasos: number; restantes: number }> {
    const now = new Date();
    const user = await this.users.findById(userId);
    if (!user || !user.canAuthenticate()) throw cuotaAgotada('cuenta');
    const e = await this.effective.resolve(userId, now);
    const limInv = intEntitlement(e.entitlements, 'investigaciones_mes', 0);
    const limTok = intEntitlement(e.entitlements, 'tokens_mes', 0);
    const used = await this.usage.periodUsage(userId, periodKey(now));
    if (used.investigations >= limInv) throw cuotaAgotada('investigaciones');
    if (used.tokens >= limTok) throw cuotaAgotada('tokens');
    const r = await this.usage.consume(
      {
        userId,
        kind: 'investigacion',
        units: 1,
        tokensIn: 0,
        tokensOut: 0,
        costUsd: null,
        idempotencyKey: `reserva:${this.gen.uuid()}`,
        refType: null,
        refId: null,
      },
      periodKey(now),
      limInv,
      limTok,
      1,
      0,
    );
    if (r.outcome === 'cuota_investigaciones') throw cuotaAgotada('investigaciones');
    if (r.outcome === 'cuota_tokens') throw cuotaAgotada('tokens');
    const after = await this.usage.periodUsage(userId, periodKey(now));
    return {
      maxPasos: intEntitlement(e.entitlements, 'max_pasos', 6),
      restantes: Math.max(0, limInv - after.investigations),
    };
  }

  /** Registra tokens/costo reales de una investigación (idempotente). */
  async recordInvestigation(
    userId: string,
    investigacionId: string,
    tokensIn: number,
    tokensOut: number,
    costUsd: number,
  ): Promise<void> {
    await this.usage.record(
      {
        userId,
        kind: 'investigacion_tokens',
        units: 0,
        tokensIn,
        tokensOut,
        costUsd,
        idempotencyKey: `inv:${investigacionId}:tokens`,
        refType: 'investigacion',
        refId: investigacionId,
      },
      periodKey(new Date()),
    );
  }

  /**
   * Pre-vuelo chat: compuerta blanda por tokens (sin consumir conteo de
   * investigaciones; el chat se mide por tokens). Lanza 429 si agotado.
   */
  async reserveChat(userId: string): Promise<{ modelos: string[]; tokensRestantes: number }> {
    const now = new Date();
    const user = await this.users.findById(userId);
    if (!user || !user.canAuthenticate()) throw cuotaAgotada('cuenta');
    const e = await this.effective.resolve(userId, now);
    const limTok = intEntitlement(e.entitlements, 'tokens_mes', 0);
    const used = await this.usage.periodUsage(userId, periodKey(now));
    if (used.tokens >= limTok) throw cuotaAgotada('tokens');
    return {
      modelos: modelosPermitidos(e.entitlements),
      tokensRestantes: Math.max(0, limTok - used.tokens),
    };
  }

  /** Registra tokens/costo de un mensaje de chat (idempotente por msg). */
  async recordChat(
    userId: string,
    messageId: string,
    tokensIn: number,
    tokensOut: number,
    costUsd: number,
  ): Promise<void> {
    await this.usage.record(
      {
        userId,
        kind: 'chat',
        units: 0,
        tokensIn,
        tokensOut,
        costUsd,
        idempotencyKey: `chat:${messageId}`,
        refType: 'message',
        refId: messageId,
      },
      periodKey(new Date()),
    );
  }

  /**
   * B11: registra una llamada auxiliar barata (título/sugerencias).
   * Idempotente por clave: el llamador decide si reintentos re-cobran.
   */
  async recordAux(
    userId: string,
    kind: 'titulo' | 'sugerencias',
    idempotencyKey: string,
    refId: string,
    tokensIn: number,
    tokensOut: number,
    costUsd: number,
  ): Promise<void> {
    await this.usage.record(
      {
        userId,
        kind,
        units: 0,
        tokensIn,
        tokensOut,
        costUsd,
        idempotencyKey,
        refType: 'conversation',
        refId,
      },
      periodKey(new Date()),
    );
  }

  /**
   * Marca una abstención honesta del chat (métrica, costo cero: no consume
   * cuota de tokens; los tokens ya quedaron en el evento `chat`).
   */
  async recordAbstencion(userId: string, messageId: string): Promise<void> {
    await this.usage.record(
      {
        userId,
        kind: 'abstencion',
        units: 0, // 0: units alimenta la cuota de investigaciones; la abstención no consume
        tokensIn: 0,
        tokensOut: 0,
        costUsd: 0,
        idempotencyKey: `abst:${messageId}`,
        refType: 'message',
        refId: messageId,
      },
      periodKey(new Date()),
    );
  }

  /** Registra el costo del juez de una verificación (cada llamada = costo nuevo). */
  async recordVerification(
    userId: string,
    investigacionId: string,
    tokensIn: number,
    tokensOut: number,
    costUsd: number,
  ): Promise<void> {
    await this.usage.record(
      {
        userId,
        kind: 'verificacion',
        units: 1,
        tokensIn,
        tokensOut,
        costUsd,
        idempotencyKey: `rep:${investigacionId}:${this.gen.uuid()}`,
        refType: 'investigacion',
        refId: investigacionId,
      },
      periodKey(new Date()),
    );
  }
}
