# DEMO_SCRIPT — demo de 5 minutos (+ contingencia)

## Pre-demo (1 hora antes)

```powershell
cd C:\Dev\Hackaton\LexAgent
docker compose up -d
# comprobar:
Invoke-RestMethod http://localhost:3000/health          # status ok
(Invoke-WebRequest http://localhost:4173 -UseBasicParsing).StatusCode  # 200
```

- Abrir en el navegador: UI http://localhost:4173 (pestaña 1), informe de respaldo `demo/informe-demo-respaldo.md` (pestaña 2, por si falla el vivo).
- Verificar saldo de Meta Model API en su consola (única dependencia externa en vivo).
- Tener a mano este guion + [HACKATHON_PLAN.md](HACKATHON_PLAN.md) §"No prometer".

## Guion (≤ 5:00)

| Tiempo | Qué hacer | Qué decir |
|---|---|---|
| 0:00–0:30 | UI en pantalla. | "Kelsyx AI: investigas norma + jurisprudencia + contratación en un solo lugar, y cada afirmación trae su cita verificada. Si no hay evidencia, lo dice." |
| 0:30–2:00 | Pegar pregunta 1 y pulsar Investigar. Mientras corre (~40–90 s), narrar la traza. | Pregunta: `¿Qué dice el artículo 24 de la Ley 80 de 1993 sobre transparencia?` "El agente busca normas, verifica citas y arma el informe con veredictos." |
| 2:00–2:45 | Al llegar el informe: señalar ✓/~/○, pulsar una cita → panel muestra el fragmento exacto. | "Cada ✓ resolvió a un fragmento real del corpus. Cero citas inventadas en 30 preguntas evaluadas." |
| 2:45–3:45 | Bajar a Contratos SECOP: `entidad=medellin`, Buscar. Señalar una señal + enlace origen. | "Contratos reales sincronizados de SECOP II, con enlace al origen. Las señales son indicios, no acusaciones." |
| 3:45–4:30 | Botón Descargar Markdown. Mostrar métricas: recall@8 100%, costo ~$0.03/investigación. | "El informe exportable trae fuentes, traza, costo y limitaciones." |
| 4:30–5:00 | Cierre. | "Limitaciones honestas: 3 documentos semilla, sin sentencias aún, vigencia no verificada. Siguiente: jurisprudencia y monitor de novedades." |

Pregunta de repuesto (probada, ~15 s): `¿Qué dice la Constitución sobre el derecho de petición?`

## Contingencia

| Falla | Plan B |
|---|---|
| Investigar tarda > 2 min | Narrar la traza; si no llega, abrir pestaña 2: `demo/informe-demo-respaldo.md` (informe real generado hoy, ID `d1197695`) |
| Meta API sin saldo / error | Todo lo demás es local: mostrar `/report/d1197695-2d32-499e-9b80-bc9d7861e4bc` (veredicto corre con juez; si también falla, el `.md` estático no necesita red) |
| Web caída (`:4173`) | API directa: `GET /search?q=transparencia`, `GET /secop/contracts?entidad=medellin` (curl o navegador) |
| Contenedor caído | `docker compose up -d` (verificado: levanta en ~30 s con datos intactos) |
| Pregunta del jurado fuera de corpus | Hacerla igual: el sistema debe abstenerse en vivo (demostración del diferenciador) |

## No prometer (recordatorio)

Vigencia garantizada, cobertura completa de jurisprudencia, detección de corrupción, tiempo real, asesoría jurídica automática.
