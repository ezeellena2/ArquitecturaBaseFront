# ArquitecturaBaseFront

SPA (React + Vite + TypeScript) de la plantilla base. Se conecta al backend de [ArquitecturaBase](../ArquitecturaBase), que resuelve login con código por email, Google, OpenIddict, roles y permisos.

## Levantar el proyecto

Desde la raíz del backend (`../ArquitecturaBase`):

```bash
aspire run
```

Esto levanta Postgres, la Api y este front en `https://localhost:5173`.

## Tests

```bash
npm run test        # una corrida
npm run test:watch  # modo watch
```

## Diseño

El diseño aprobado está en [`../ArquitecturaBase/docs/specs/2026-09-18-arquitectura-base-design.md`](../ArquitecturaBase/docs/specs/2026-09-18-arquitectura-base-design.md) (sección 7).
