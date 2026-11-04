# tests/e2e — escenarios de navegador (Playwright)

Cada `e2e_*.mjs` es un escenario independiente (cuenta, archivos, chat,
guardarraíles, memoria, modelos, storage, visual...). Instalación separada
a propósito: cada app (`apps/api`, `apps/web`, `tests/e2e`) tiene su propio
`package-lock.json` y se instala por separado.

## Requisitos

- Stack completo arriba (`docker compose up -d`): API `:3000`, web `:4173`.
- Microsoft Edge en Windows (los scripts usan `executablePath` fijo) o
  adaptar la ruta en cada script.

## Uso (desde `tests/e2e/`)

```powershell
cd tests/e2e
npm ci                    # instala playwright-core
node e2e_visual.mjs       # un escenario (las shots/ son relativas al CWD)
```

Las capturas van a `tests/e2e/shots/` (ignorado por git). Los escenarios
crean usuarios de prueba (`*@lex.co`) en la DB local.
