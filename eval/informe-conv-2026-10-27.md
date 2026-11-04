# Eval conversacional D3 — 2026-10-27

**Resultado: 9/9 turnos.** Retrieval multi-turno + memoria + abstención (`eval/conversacion.json`, runner `tests/eval/run_eval_conv.mjs`).

| Diálogo | Turno | Espera | Hit | Citas | Tools | ms |
|---|---|---|---|---|---|---|
| C1 | 1 | cita 80/1993 art 24 | sí | 8 | 5 | 37426 |
| C1 | 2 | cita 80/1993 art 24 | sí | 5 | 2 | 11886 |
| C1 | 3 | texto contiene "80" | sí | 0 | 0 | 4044 |
| C2 | 1 | cita CP/1991 art 11 | sí | 3 | 1 | 4033 |
| C2 | 2 | cita CP/1991 art 23 | sí | 3 | 1 | 6877 |
| C2 | 3 | texto contiene "constitu" | sí | 3 | 1 | 7178 |
| C3 | 1 | abstención honesta | sí | 8 | 2 | 10975 |
| C3 | 2 | cita 1150/2007 art 5 | sí | 5 | 2 | 19420 |
| C3 | 3 | cita 1150/2007 art 2 | sí | 8 | 1 | 9157 |

Rutas citadas por turno:

- **C1t1**: `Ley 80/1993 > Art. 24 > encabezado`, `Ley 80/1993 > Art. 24 > num. 1o > parte 1`, `Ley 80/1993 > Art. 24 > num. 1o > parte 2`, `Ley 80/1993 > Art. 24 > num. 4o`, `Ley 80/1993 > Art. 24 > num. 1o > parte 3`, `Ley 80/1993 > Art. 24 > num. 5o > parte 2`, `Ley 80/1993 > Art. 24 > num. 5o > parte 6`, `Ley 80/1993 > Art. 24 > num. 5o > parte 9`
- **C1t2**: `Ley 80/1993 > Art. 24 > encabezado`, `Ley 80/1993 > Art. 24 > num. 1o > parte 1`, `Ley 80/1993 > Art. 24 > num. 1o > parte 2`, `Ley 80/1993 > Art. 24 > num. 4o`, `Ley 80/1993 > Art. 24 > num. 1o > parte 3`
- **C1t3**: (sin citas)
- **C2t1**: `Const. 1991 > Art. 11`, `Const. 1991 > Art. 119`, `Const. 1991 > Art. 110`
- **C2t2**: `Const. 1991 > Art. 23`, `Const. 1991 > Art. 235 > num. 2`, `Const. 1991 > Art. 235 > num. 8`
- **C2t3**: `Const. 1991 > Art. 11`, `Const. 1991 > Art. 119`, `Const. 1991 > Art. 110`
- **C3t1**: `Const. 1991 > Art. 103`, `Const. 1991 > Art. 34 > encabezado`, `Ley 80/1993 > Art. 8o > num. 4 > parte 11`, `Ley 80/1993 > Art. 57`, `Const. 1991 > Art. 34 > Par.`, `Ley 80/1993 > Art. 8o > num. 4 > parte 12`, `Ley 80/1993 > Encabezado > parte 6`, `Const. 1991 > Art. 11`
- **C3t2**: `Ley 1150/2007 > Art. 5o > encabezado`, `Ley 1150/2007 > Art. 5o > num. 1`, `Ley 1150/2007 > Art. 5o > num. 2`, `Ley 1150/2007 > Art. 5o > num. 2`, `Ley 1150/2007 > Art. 5o > num. 3`
- **C3t3**: `Ley 1150/2007 > Art. 2o > num. 2 > parte 2`, `Ley 1150/2007 > Art. 2o > encabezado`, `Ley 1150/2007 > Art. 2o > num. 1`, `Ley 1150/2007 > Art. 2o > num. 2 > parte 1`, `Ley 1150/2007 > Art. 2o > num. 2 > parte 3`, `Ley 1150/2007 > Art. 2o > num. 163`, `Ley 1150/2007 > Art. 2o > num. 2 > parte 6`, `Ley 1150/2007 > Art. 2o > num. 2`
