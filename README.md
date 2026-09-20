# ArquitecturaBaseFront

SPA de la plantilla base: React 19 + Vite 8 + TypeScript, con Tailwind 4, shadcn/ui, TanStack Query, react-router e i18next (español e inglés).

Es la cara del backend [ArquitecturaBase](../ArquitecturaBase), que resuelve el ingreso con código por email y con Google, OpenIddict, roles y permisos. Este repo no tiene backend propio: todas las llamadas van a esa Api.

## Requisitos

- Node 24 y npm 11.
- `npm install` la primera vez.
- Para levantar todo junto, lo del backend: .NET 10, Docker y la Aspire CLI.

## Levantar el proyecto

**Todo junto (lo normal).** Desde la raíz del backend:

```bash
cd ../ArquitecturaBase
aspire run
```

Aspire levanta Postgres, la Api y este front, y le pasa a Vite el certificado de desarrollo. El navegador habla con un solo origen, `https://localhost:5173`: Vite sirve el SPA y reenvía `/api`, `/account`, `/connect`, `/signin-google` y `/.well-known` a la Api (`vite.config.ts`, `server.proxy`). La Api queda en `https://localhost:7180`, pero no hace falta abrirla.

**Solo el front.**

```bash
npm run dev
```

Vite queda en `http://localhost:5173` (sin Aspire no hay certificado, así que es http) y reenvía el backend a `https://localhost:7180`, que tenés que levantar aparte. Sirve para trabajar en una pantalla suelta: el ingreso real no funciona por http, porque las redirect URIs registradas del cliente `web` son `https`.

## Scripts

| Comando | Qué hace |
|---|---|
| `npm run dev` | servidor de desarrollo con recarga en caliente |
| `npm run build` | `tsc -b` y después `vite build`; deja el resultado en `dist/` |
| `npm run lint` | oxlint sobre todo el repo |
| `npm run test` | Vitest, una corrida (`npm run test:watch` para el modo watch) |
| `npm run preview` | sirve el `dist/` ya compilado |

Antes de dar algo por terminado, los tres del medio tienen que estar limpios.

## Estructura

```
src/
  app/        composición: router, rutas y providers
  auth/       sesión OIDC, rutas protegidas y permisos
  shared/     cliente HTTP, hooks, i18n y la biblioteca de componentes (ui)
  layouts/    AuthLayout, AppLayout, menú lateral, barra superior
  features/   un módulo por área (auth, home, users, errors), cada uno con sus páginas y llamadas
  locales/    traducciones, un archivo por idioma y módulo
```

Una feature nunca importa de otra: lo común sube a `shared`.

## Producción

`npm run build` deja el sitio estático en `dist/`. En producción lo sirve la Api desde su `wwwroot` (un solo origen, sin CORS). **Hoy no hay nada que copie `dist/` a `wwwroot`:** ese paso todavía no existe y lo tiene que resolver el pipeline de despliegue. Está anotado como pendiente en el [plan de la Fase 3](../ArquitecturaBase/docs/plans/2026-09-19-fase-3-front-base.md).

## Diseño y planes

- Diseño aprobado (sección 7): [`../ArquitecturaBase/docs/specs/2026-09-18-arquitectura-base-design.md`](../ArquitecturaBase/docs/specs/2026-09-18-arquitectura-base-design.md).
- Planes por fase: [`../ArquitecturaBase/docs/plans/`](../ArquitecturaBase/docs/plans/). Este front sale de la Fase 3.
- Convenciones para trabajar acá: [CLAUDE.md](CLAUDE.md).
