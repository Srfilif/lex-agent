-- 018: vectores a 3072 dims (EMBED_PROVIDER=gemini, gemini-embedding-001).
-- La columna vectorial sigue al proveedor activo: 1024 = ollama/bge-m3,
-- 3072 = gemini. Solo aplica sobre BD sin vectores 1024 guardados (ALTER TYPE
-- falla si hay datos con otras dims: borra y re-ingiere en ese caso).
DROP INDEX IF EXISTS idx_chunks_embedding;
ALTER TABLE chunks ALTER COLUMN embedding TYPE vector(3072);
CREATE INDEX IF NOT EXISTS idx_chunks_embedding
  ON chunks USING hnsw (embedding vector_cosine_ops);
DROP INDEX IF EXISTS idx_pchunk_embedding;
ALTER TABLE project_chunks ALTER COLUMN embedding TYPE vector(3072);
CREATE INDEX IF NOT EXISTS idx_pchunk_embedding
  ON project_chunks USING hnsw (embedding vector_cosine_ops);
