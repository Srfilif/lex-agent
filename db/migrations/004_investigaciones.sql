-- 004: investigaciones del agente (pregunta, traza, respuesta, uso).
CREATE TABLE investigaciones (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pregunta   TEXT NOT NULL,
  traza      JSONB NOT NULL,   -- pasos: tool calls + resúmenes
  respuesta  JSONB NOT NULL,   -- JSON final del modelo (afirmaciones[])
  usage      JSONB NOT NULL,   -- {prompt, completion, total}
  costo_usd  NUMERIC,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
