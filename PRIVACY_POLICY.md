# Política de Tratamiento de Datos Personales — Kelsyx (Kelsyx)

- **Versión:** v1.0 — 2026-11-18 (`2026-11-18-v1`).
- **Responsable del tratamiento:** Andrés Felipe Ángel (persona natural, Colombia).
  [PENDIENTE: TIPO Y NÚMERO DE DOCUMENTO] · [PENDIENTE: DOMICILIO]
- **Contacto del responsable:** srfilif@gmail.com · https://srfilif.dev
- **Encargados:** proveedores de infraestructura, modelo de IA, embeddings y
  correo descritos en el §6. [PENDIENTE: CONTRATOS DE ENCARGADO/DTA FIRMADOS]
- **Base normativa:** Constitución Política art. 15; Ley 1581 de 2012; Decreto
  1074 de 2015 (Libro 2, Parte 2, Título 2, Capítulos 25 y 26, que compila el
  Decreto 1377 de 2013 y el Decreto 886 de 2014); lineamientos de la SIC.

Esta política describe el tratamiento real aplicado por la plataforma. El
procedimiento interno (roles, incidentes, retención operativa) está en
[DATA_PROCESSING_POLICY.md](DATA_PROCESSING_POLICY.md).

## 1. Datos que se recopilan

| Categoría | Datos | Origen |
|---|---|---|
| Identificación de cuenta | correo, contraseña (solo hash scrypt), nombre visible, rol, estado, verificación de correo | registro y perfil |
| Seguridad y acceso | sesiones (etiqueta de dispositivo, IP, agente de usuario, MFA), eventos de seguridad (IP, agente de usuario), secreto TOTP cifrado, hashes de códigos de recuperación | uso y configuración |
| Preferencias | tema, idioma, zona horaria, notificaciones, modelo y formato de IA | configuración |
| Contenido del servicio | conversaciones y mensajes, proyectos e instrucciones, archivos `.txt`/`.md` y fragmentos, memorias (máx. 50 hechos), investigaciones (pregunta, traza, respuesta) | uso |
| Facturación (sandbox) | plan, suscripción, pagos y eventos de uso simulados | panel de facturación |
| Contacto (landing) | nombre, correo y mensaje — solo se abre su cliente de correo (mailto), no se envía al servidor | formulario de contacto |

No se solicitan datos sensibles ni datos de menores. Sin embargo, los archivos,
mensajes y memorias que usted escriba **pueden contenerlos**; la plataforma no
aplica filtros automáticos de contenido sensible (ver §9).

## 2. Finalidades

Crear y administrar su cuenta; autenticar y proteger el acceso (incl. TOTP y
detección de fraude); prestar las funciones solicitadas (chat, proyectos,
memoria, investigaciones, SECOP); personalizar preferencias; facturar cuando
aplique; cumplir obligaciones legales; atender consultas y reclamos; mejorar la
seguridad y calidad del servicio. No se usan sus datos para publicidad de
terceros ni se venden bases de datos.

## 3. Fundamento jurídico y autorización

El tratamiento se fundamenta en su **autorización previa, expresa e informada**
(Ley 1581, art. 9), otorgada en casilla independiente al registrarse, más la
ejecución de la relación contractual y el cumplimiento legal (seguridad,
facturación). Sin autorización no es posible crear la cuenta, porque el correo
y la clave son indispensables para el servicio. La autorización indica versión
de esta política, fecha y hora, y se conserva como prueba.

## 4. Derechos del titular (Ley 1581, art. 8)

Conocer, actualizar y rectificar sus datos; solicitar prueba de la autorización;
ser informado del uso dado; revocar la autorización o pedir supresión cuando no
exista deber legal de conservar; presentar quejas ante la SIC. Ejercicio:
autoservicio en la app (Cuenta: perfil, exportación JSON, borrado en 2 pasos)
o correo a srfilif@gmail.com, asunto "Habeas data".

## 5. Consultas y reclamos

- **Consultas:** se atienden en máximo 10 días hábiles (+5 si se informa el
  motivo). Incluya nombre, correo de la cuenta y descripción.
- **Reclamos (corrección, actualización, supresión):** se atienden en máximo 15
  días hábiles (+8 si se informa). Si falta información, se le pedirá subsanar.
- Ante la SIC procede reclamación una vez agotado este trámite (art. 16).

## 6. Terceros y transferencias internacionales

Sus contenidos e identificadores técnicos pueden transmitirse a:

- **Meta Model API** (chat y embeddings, `api.meta.ai`) — procesamiento de IA.
- **Google Gemini** (embeddings) u **Ollama local** (según configuración).
- **Proveedor SMTP** [PENDIENTE: IDENTIFICAR PROVEEDOR Y PAÍS] — correos
  transaccionales (verificación, recuperación, tokens).
- **Hosting y bases de datos** [PENDIENTE: PROVEEDOR Y UBICACIÓN] — alojamiento.
- **Fuentes públicas SECOP** (datos.gov.co) — solo lectura de datos públicos.

Meta y Google procesan fuera de Colombia (**transferencia internacional**,
Ley 1581 art. 26). Al aceptar, usted autoriza expresamente estas
transferencias para las finalidades del §2. [PENDIENTE: PAÍS DE CADA
PROVEEDOR, DPA/DTA Y NIVEL ADECUADO DE PROTECCIÓN]. Recomendación operativa:
no cargue información confidencial, sensible o de menores (ver §9).

## 7. Conservación y eliminación

Cuenta activa: durante la relación. Al cerrar la cuenta: anonimización del
perfil, revocación de sesiones (registros 90 días), eventos de seguridad
anonimizados 1 año, archivos borrados de disco y base de datos de inmediato,
pagos/uso/suscripciones conservados por obligación legal, investigaciones
desvinculadas y anónimas. Purga automática de sesiones >90 días y eventos
>1 año. Exportación disponible en JSON (excluye hashes y secretos).

## 8. Seguridad

Hash de contraseñas (scrypt), TOTP cifrado (AES-GCM), JWT de corta duración con
refresh rotatorio y detección de reúso, cookie `lex_refresh` HttpOnly/SameSite,
rate-limit, registros de auditoría, copias de seguridad. Ver
[SECURITY.md](SECURITY.md). Ningún sistema es infalible: ante un incidente que
afecte sus datos se le notificará y se reportará a la SIC cuando corresponda.

## 9. Datos sensibles y menores de edad

El servicio es solo para mayores de 18 años y no solicita datos sensibles
(origen racial, salud, biométricos, opiniones, etc.). Si usted los incluye en
archivos, mensajes o memorias, lo hace bajo su responsabilidad y autoriza su
tratamiento instrumental para prestarle el servicio. El operador puede
restringir o eliminar contenidos con datos sensibles de terceros o de menores
conforme a la Política de Uso Aceptable.

## 10. Cookies y almacenamiento local

Ver [Política de Cookies](COOKIE_POLICY.md): cookie técnica `lex_refresh`,
tokens de sesión y preferencia de tema en almacenamiento local. Sin analítica
ni publicidad de terceros en el código auditado.

## 11. Canal de atención al titular

Correo: srfilif@gmail.com, asunto "Habeas data". [PENDIENTE: RESPONSABLE
INTERNO DESIGNADO, FORMULARIO WEB Y HORARIO DE ATENCIÓN]. Conservaremos el
registro de su solicitud y respuesta.

## 12. Revocatoria y supresión

Puede revocar la autorización total (equivale a cerrar la cuenta, §7) o pedir
supresión parcial de contenidos (borrar conversaciones, proyectos, archivos,
memorias desde la app). La revocatoria no afecta tratamientos con deber legal
de conservación ni tratamientos ya realizados con autorización vigente.

## 13. Cambios a esta política

Cambios sustanciales (nuevas finalidades, nuevos terceros o transferencias) se
notifican con 30 días y pueden requerir nueva autorización. La versión vigente
y el historial se publican en la landing (/privacidad) y en este repositorio.

## 14. Registro Nacional de Bases de Datos (RNBD)

[PENDIENTE: DETERMINAR OBLIGATORIEDAD SEGÚN NATURALEZA JURÍDICA Y UMBRAL DE
UVT VIGENTE ANTE LA SIC; SI APLICA, INSCRIBIR Y PUBLICAR NÚMERO DE RADICADO.]
