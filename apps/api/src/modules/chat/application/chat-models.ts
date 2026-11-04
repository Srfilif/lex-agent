// B7: catálogo efectivo de modelos de chat para el plan del usuario.
import { Inject, Injectable } from '@nestjs/common';
import { AppConfig, CONFIG } from '../../../shared/config';
import { BillingForAgent } from '../../billing';

@Injectable()
export class ChatModels {
  constructor(
    private readonly billing: BillingForAgent,
    @Inject(CONFIG) private readonly cfg: AppConfig,
  ) {}

  async execute(userId: string): Promise<Record<string, unknown>> {
    const reserve = await this.billing.reserveChat(userId);
    const disponibles = reserve.modelos.filter((m) => this.cfg.chatModels.includes(m));
    const defecto = disponibles[0] ?? this.cfg.metaModel;
    return {
      defecto,
      modelos: disponibles.map((id) => ({ id, defecto: id === defecto })),
    };
  }
}
