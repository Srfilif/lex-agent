// Interfaz pública del módulo corpus (regla 5).
export { CorpusModule } from './corpus.module';
export { SearchDocuments } from './application/search-documents';
export { IngestDocument } from './application/ingest-document';
export { CORPUS_REPOSITORY, CorpusRepository, ChunkRow, ChunkRef, CorpusFiltros, DocumentoCobertura } from './domain/repositories';
export { SearchFiltros, SearchHit, fuseRrf } from './domain/retrieval';
// Dominio puro reutilizable por ingesta (transitorio hasta Bloque E).
export { Chunk, chunkNorma, chunkParrafos } from './domain/chunk';
export { normalizeText } from './domain/normalize';
export { EMBEDDING_PORT, EmbeddingPort } from './application/ports';
