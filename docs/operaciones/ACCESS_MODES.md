# Modos de acceso a la plataforma

La plataforma opera en uno de 5 modos, configurable en el `.env`
(`ACCESS_MODE`, requiere reinicio). `open` se acepta como alias histórico de
`public`.

## Modos implementados

| Modo | Registro | Login / refresh | Sesiones activas | Invitado anónimo | Caso de uso |
|---|---|---|---|---|---|
| `public` (default) | Libre (Términos + datos) | Todos | Todas | Según flag | Lanzamiento, beta abierta |
| `maintenance` | Bloqueado | Solo admins | Solo admins (guard) | No | Despliegues, incidentes, migraciones |
| `closed` | Bloqueado (403) | Todos | Todas | No | Congelar altas: pausa, pre-lanzamiento |
| `whitelist` | Solo autorizados (403) | Solo autorizados + admins | Hasta el refresh | No | Pilotos, universidades, convenios |
| `code` | Solo con código (403) | Todos | Todas | No | Eventos, demos, cohortes, early-access |

Notas: en `maintenance` el guard rechaza con 403 `mantenimiento` toda petición
autenticada no-admin (incluye sesiones ya abiertas); el login de admins sigue
normal. En `whitelist`, login y refresh exigen correo autorizado, salvo admins
(siempre pasan, para no bloquear la operación). Los códigos solo se verifican
al registrar (se consumen ahí).

## Variables

```env
ACCESS_MODE=public          # public | maintenance | closed | whitelist | code
ACCESS_WHITELIST=ana@uni.edu.co,*@empresa.co   # csv; unión con la BD
ACCESS_CODE=KX-2026-DEMO    # código único estático; vacío = solo códigos de BD
```

- Whitelist acepta correos exactos y comodines de dominio `*@dominio.tld`
  (insensible a mayúsculas; sin subdominios implícitos). Fuente: unión de
  `.env` + tabla `access_whitelist` (migración 020).
- Códigos: el estático del `.env` no se agota ni expira; los gestionados viven
  en `access_codes` (hash sha256, nunca en claro) con usos máximos, expiración
  y revocación. El consumo de usos es atómico (anti doble-uso concurrente).
- El registro tiene rate-limit (5 intentos/hora por IP), que también frena la
  fuerza bruta contra códigos.

## Gestión

CLI (sin UI): `npm run access -- mode|wlist|allow|unallow|clist|code|revoke`
(ver `npm run access` sin argumentos). Panel web: Cuenta → Admin → Acceso
(solo rol admin; acciones auditadas en `security_events`).

Endpoints: `GET /auth/access-mode` (público, sin secretos; lo usa el frontend
para adaptar el registro y ocultar la entrada de invitado fuera de `public`),
`GET|POST /admin/access/whitelist`, `DELETE /admin/access/whitelist/:id`,
`GET|POST /admin/access/codes`, `POST /admin/access/codes/:id/revoke`,
`GET /admin/access/mode`.

## Operativa recomendada

- Rotar el `ACCESS_CODE` estático tras cada evento; preferir códigos
  gestionados de un uso para invitaciones nominales.
- Cambiar de modo es instantáneo al reiniciar; anunciar cierres con antelación.
- Revocar códigos filtrados de inmediato; la whitelist no cierra sesiones
  existentes (para expulsar, deshabilitar la cuenta).

## Otros modos evaluados

| Modo | Idea | Veredicto para esta app |
|---|---|---|
| Aprobación manual | Registro → pendiente → admin aprueba/rechaza | **Recomendado próximo:** ideal para pilotos jurídicos; requiere estado `pending` + bandeja + correo de aviso |
| Beta por oleadas | Cupos N por periodo (p.ej. 100/mes) | Útil si el piloto crece; implementable como `closed` + contador de altas |
| Solo lectura / demo | Entrar sin cuenta a datos de ejemplo | Interesante para marketing; hoy el invitado solo cubre Investigación |
| Solo-SSO/OAuth | Entrar solo con Google/Microsoft | Solo si un cliente institucional lo exige; sin proveedor hoy |
| Ventana temporal | Acceso solo en fechas/horas dadas | Raro para SaaS; los códigos con expiración ya cubren eventos |
| Por invitación en cadena | Cada usuario invita a N | Riesgo de crecimiento descontrolado; mejor códigos nominales |
| Geobloqueo | Solo IPs de un país | No: IP es mala prueba de ubicación y choca con teletrabajo |
| Por plan/entitlement | Funciones según suscripción | Ya existe vía billing/entitlements; ortogonal a estos modos |

## Seguridad y privacidad

Los códigos se almacenan hasheados y se muestran una sola vez al crearlos; el
endpoint público no expone listas ni hashes. Los intentos denegados se auditan
(`registro_no_autorizado`, `registro_codigo_invalido`) sin guardar el código
intentado. Cambiar el modo no altera el tratamiento de datos (ver
PRIVACY_POLICY.md) ni invalida consentimientos ya otorgados.
