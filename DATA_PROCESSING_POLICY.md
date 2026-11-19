# Manual Interno de Tratamiento de Datos (operador) — Kelsyx

- **Versión:** v1.0 — 2026-11-18.
- **Responsable:** Andrés Felipe Ángel. [PENDIENTE: DESIGNAR RESPONSABLE INTERNO
  DE DATOS Y SUPLENTE; DEFINIR SI SE REQUIERE OFICIAL DE PROTECCIÓN DE DATOS].
- **Documento público asociado:** [PRIVACY_POLICY.md](PRIVACY_POLICY.md).

Manual exigido por la Ley 1581 de 2012 (art. 17.k) y el principio de
responsabilidad demostrada (Decreto 1074 de 2015, Cap. 25). Aplica a toda
persona con acceso administrativo a datos personales de la plataforma.

## 1. Inventario de bases y finalidades

Base única lógica "Cuentas y uso Kelsyx" (Postgres/SQLite): usuarios,
sesiones, eventos de seguridad, TOTP, preferencias, conversaciones, proyectos,
archivos, memorias, investigaciones, suscripciones/pagos/uso (sandbox).
Finalidades: las del §2 de la política pública. Minimización: solo se recogen
los campos que el código usa; prohibido añadir campos personales sin actualizar
esta política y la autorización.

## 2. Autorización y prueba

Toda cuenta requiere autorización previa, expresa e informada (casillas
independientes de términos y de datos en el registro). Se conserva por cuenta:
versión de términos, versión de política, fecha/hora, medio (web vX). La
autorización es prueba ante la SIC: no se altera ni elimina mientras la cuenta
exista; al borrar la cuenta se conserva el registro anonimizado de que existió
autorización (fecha/versión, sin datos identificables).

## 3. Atención de consultas y reclamos (Ley 1581, arts. 14–16)

Canal: srfilif@gmail.com, asunto "Habeas data". [PENDIENTE: FORMULARIO WEB,
RADICADO Y HORARIO]. Procedimiento: acusar recibo en 2 días hábiles; verificar
identidad (correo de la cuenta + token o TOTP si hay duda); consultas: máximo
10 días hábiles (+5 informando motivo); reclamos: máximo 15 días hábiles (+8
informando motivo, con subsanación si falta info); registrar solicitud,
actuaciones y respuesta; informar al titular que ante la SIC procede reclamación
tras agotar este trámite.

## 4. Revocatoria y supresión

Total (cierre de cuenta): flujo en 2 pasos con token 24h + contraseña;
aplicar matriz de retención del §7 de la política pública. Parcial: borrado de
conversaciones, proyectos, archivos y memorias desde la app. Plazo máximo de
ejecución efectiva: 15 días hábiles desde la solicitud válida.

## 5. Seguridad e incidentes

Controles: scrypt, AES-GCM para TOTP, JWT corto + refresh rotatorio con
detección de reúso, cookie HttpOnly/SameSite, rate-limit, auditoría
`security_events`, copias de seguridad (ver [SECURITY.md](SECURITY.md) y
`docs/operaciones/SECURITY_OPERATIONS.md`). Ante incidente (acceso no
autorizado, filtración, pérdida): contener, evaluar alcance y riesgo para
titulares, documentar cronología, notificar a los afectados sin dilación cuando
haya riesgo, y reportar a la SIC conforme a sus lineamientos. [PENDIENTE:
PROCEDIMIENTO ESCRITO DE NOTIFICACIÓN A LA SIC Y PLANTILLAS].

## 6. Encargados y transferencias

Encargados actuales: Meta (IA), Google (embeddings, según configuración),
proveedor SMTP, hosting/BD [PENDIENTE: IDENTIFICAR PROVEEDORES, PAÍSES,
CONTRATOS DE ENCARGADO Y CLÁUSULAS DE TRANSFERENCIA]. Regla: ningún encargado
nuevo sin contrato escrito que limite finalidad, seguridad, subcontratación y
devolución/eliminación; ninguna transferencia internacional nueva sin
autorización del titular e información previa. Revisar anualmente el nivel de
protección de cada país receptor.

## 7. Retención y purga

Matriz: sesiones revocadas 90 días; eventos de seguridad anonimizados 1 año;
facturación/uso por obligación legal (mínimo tributario aplicable);
investigaciones anonimizadas al borrar cuenta; archivos borrados de inmediato.
Purga automática (`npm run purge`) verificada trimestralmente.
[PENDIENTE: CALENDARIO DE COPIAS Y VENTANA DE ELIMINACIÓN EN BACKUPS].

## 8. RNBD y rendición de cuentas

[PENDIENTE: EVALUAR OBLIGATORIEDAD RNBD Y, SI APLICA, INSCRIBIR BASES Y
ACTUALIZAR ANUALMENTE]. Llevar registro de: autorizaciones, consultas/reclamos,
incidentes, contratos de encargado, evaluaciones de impacto (IA, ver §9) y
capacitaciones. Revisión anual de este manual.

## 9. Inteligencia artificial

La plataforma procesa contenidos con modelos de terceros. Reglas: informar
siempre la intervención de IA y la necesidad de verificación profesional;
memoria cruzada desactivada por defecto (opt-in); no entrenar modelos propios
con datos de usuarios; si se usa un tier que entrene con prompts (Contributor),
solo con datos públicos y autorización expresa separada. [PENDIENTE: EVALUACIÓN
DE IMPACTO DE IA SEGÚN CIRCULAR EXTERNA SIC 002/2024 — VERIFICAR TEXTO VIGENTE].

## 10. Menores y datos sensibles

Prohibido el registro de menores de 18 años (sin verificación de edad robusta:
[PENDIENTE: DEFINIR MECANISMO]). Contenidos de usuarios con sensibles/de
menores: aplicar la Política de Uso Aceptable (restricción/eliminación) y, si
hay datos de terceros afectados, evaluar notificación.
