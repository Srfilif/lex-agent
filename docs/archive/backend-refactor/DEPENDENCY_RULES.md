# DEPENDENCY_RULES.md

1. `domain/` no importa `application/`, `infrastructure/`, `presentation`, `@nestjs/*` ni `pg`.
2. `application/` importa `domain/` y puertos; nunca `infrastructure/` ni `pg`.
3. `infrastructure/` implementa puertos de `application/`/`domain`; es el único que importa `pg`.
4. `presentation/` invoca casos de uso; no SQL, no reglas, no `pg`.
5. Prohibido importar `infrastructure/` de otro módulo; cruzar módulos solo vía casos de uso expuestos o puertos públicos del módulo (`corpus.module.ts` exporta).
6. Prohibido `new` de providers fuera de la composición (módulos) y CLIs (que deben resolver del contenedor).
7. Prohibido `process.env` fuera de `shared/config`.
8. Sin dependencias circulares; sin `forwardRef` salvo justificación escrita aquí.
9. Sin `any` nuevo; los existentes (ninguno hoy) requieren comentario.
10. Contratos HTTP y tablas: ver AUDIT.md §8/§10; cualquier excepción, ADR + compatibilidad.

## Verificación (rápida, sin tooling nuevo)

```powershell
# desde apps/api (PS 5.1: Select-String no tiene -Recurse; usar Get-ChildItem)
Get-ChildItem src -Recurse -Filter *.ts | Select-String "@nestjs|from 'pg'|process\.env" | Where-Object { $_.Path -match 'modules.+.domain' }   # vacío
Get-ChildItem src -Recurse -Filter *.ts | Select-String "process\.env"   # solo shared/config
```

Excepciones vigentes: ninguna.
