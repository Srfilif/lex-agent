import { Controller, Get, NotFoundException, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { SearchDocuments } from '../application/search-documents';
import { SearchQueryDto } from './dto';

@Controller('search')
export class SearchController {
  constructor(private readonly svc: SearchDocuments) {}

  @Get()
  async search(@Query() query: SearchQueryDto): Promise<Record<string, unknown>> {
    const { q, top_k, tipo, emisor, numero, jurisdiccion, tema } = query;
    if (!q?.trim()) return { error: 'falta parámetro q', hits: [] };
    const { hits, ms } = await this.svc.execute(q.trim(), {
      topK: top_k,
      tipo: tipo || undefined,
      emisor: emisor || undefined,
      numero: numero || undefined,
      jurisdiccion: jurisdiccion || undefined,
      tema: tema || undefined,
    });
    return { q, count: hits.length, ms, hits };
  }

  @Get('documentos')
  async documentos(): Promise<Record<string, unknown>> {
    return this.svc.coverage();
  }

  @Get('chunk/:id')
  async chunk(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<Record<string, unknown>> {
    const c = await this.svc.chunk(id);
    if (!c) throw new NotFoundException('fragmento no encontrado');
    return c;
  }
}
