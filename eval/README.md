# eval/ — datasets e informes de evaluación

- Datasets: `preguntas.json` (eval puntual), `conversacion.json` (eval
  multi-turno).
- Runners: `python tests/eval/run_eval.py` y
  `node tests/eval/run_eval_conv.mjs` (requieren stack vivo; consumen LLM).
- Informes fechados: `informe-*.md` (evidencia que sí se commitea).
- `resultados-*.json` son salida desechable (ignorados por git).
