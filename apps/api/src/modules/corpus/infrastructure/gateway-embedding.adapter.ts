import { Injectable } from '@nestjs/common';
import { ModelGateway } from '../../../gateway/model-gateway';
import { EmbeddingPort } from '../application/ports';

// Adaptador: expone el gateway compartido tras el puerto que pide el caso de uso.
@Injectable()
export class GatewayEmbeddingAdapter implements EmbeddingPort {
  constructor(private readonly gateway: ModelGateway) {}

  embed(texts: string[]): Promise<number[][]> {
    return this.gateway.embed(texts);
  }
}
