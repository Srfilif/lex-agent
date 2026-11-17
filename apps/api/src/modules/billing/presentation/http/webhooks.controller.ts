// Webhooks de proveedor: cuerpo crudo + firma (HMAC sandbox).
// Requiere rawBody (main.ts). Sin auth de usuario: la firma es la auth.
import {
  BadRequestException,
  Controller,
  Inject,
  Param,
  Post,
  Req,
  UseFilters,
} from '@nestjs/common';
import { AuthErrorFilter, RequestMeta } from '../../../identity';
import { HandleWebhook } from '../../application/handle-webhook';
import { PAYMENT_PROVIDER, PaymentProvider } from '../../application/ports';

interface RawReq {
  headers: Record<string, string | string[] | undefined>;
  ip?: string;
  rawBody?: Buffer;
}

function metaOf(req: RawReq): RequestMeta {
  const h = (k: string): string | null => {
    const v = req.headers[k];
    if (Array.isArray(v)) return v[0] ?? null;
    return v ?? null;
  };
  const xff = h('x-forwarded-for');
  const ip = (xff?.split(',')[0]?.trim() || req.ip || null) as string | null;
  return { ip, userAgent: h('user-agent') };
}

function header(req: RawReq, k: string): string {
  const v = req.headers[k];
  const s = Array.isArray(v) ? v[0] : v;
  return (s ?? '').trim();
}

@Controller('billing/webhooks')
@UseFilters(AuthErrorFilter)
export class WebhooksController {
  constructor(
    private readonly handle: HandleWebhook,
    @Inject(PAYMENT_PROVIDER) private readonly provider: PaymentProvider,
  ) {}

  @Post(':provider')
  async webhookPost(
    @Param('provider') provider: string,
    @Req() req: RawReq,
  ): Promise<Record<string, unknown>> {
    const raw = req.rawBody;
    if (!raw || !Buffer.isBuffer(raw) || raw.length === 0 || raw.length > 1024 * 1024) {
      // Sin cuerpo crudo no se puede verificar firma: rechazar.
      throw new BadRequestException('cuerpo inválido');
    }
    const sigHeader =
      provider === this.provider.name ? this.provider.signatureHeader : 'x-provider-signature';
    return this.handle.execute(
      provider.trim().toLowerCase().slice(0, 20),
      raw,
      header(req, sigHeader),
      metaOf(req),
    );
  }
}
