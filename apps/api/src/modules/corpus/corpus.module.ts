import { Module } from '@nestjs/common';
import { SharedModule } from '../../shared/shared.module';
import { CORPUS_REPOSITORY } from './domain/repositories';
import { EMBEDDING_PORT } from './application/ports';
import { SearchDocuments } from './application/search-documents';
import { IngestDocument } from './application/ingest-document';
import { PgCorpusRepository } from './infrastructure/pg-corpus.repository';
import { GatewayEmbeddingAdapter } from './infrastructure/gateway-embedding.adapter';
import { SearchController } from './presentation/search.controller';

@Module({
  imports: [SharedModule],
  controllers: [SearchController],
  providers: [
    { provide: CORPUS_REPOSITORY, useClass: PgCorpusRepository },
    { provide: EMBEDDING_PORT, useClass: GatewayEmbeddingAdapter },
    SearchDocuments,
    IngestDocument,
  ],
  exports: [SearchDocuments, IngestDocument, CORPUS_REPOSITORY, EMBEDDING_PORT],
})
export class CorpusModule {}
