# ArquitecturaBaseFront: guía para agentes

SPA de la plantilla base. El backend vive en `../ArquitecturaBase` y el diseño aprobado, en `../ArquitecturaBase/docs/specs/2026-09-18-arquitectura-base-design.md` (sección 7). Los planes por fase están en `../ArquitecturaBase/docs/plans/`.

## Forma de trabajo

- Se trabaja directo en `main`. No crear ramas ni hacer push sin un pedido explícito.
- Commits chicos, en español, con conventional commits.
- Antes de dar algo por terminado: `npm run build`, `npm run lint` y `npm run test`, los tres limpios.

## Comandos

- Desarrollo: `aspire run` desde `../ArquitecturaBase` levanta Postgres, la Api y este front en `https://localhost:5173`.
- Solo el front: `npm run dev` (necesita la Api aparte y el certificado de desarrollo).
- Tests: `npm run test`; en modo watch, `npm run test:watch`.

## Estructura

- `src/app`: composición (router y providers).
- `src/auth`: sesión OIDC, rutas protegidas y permisos.
- `src/shared`: lo que usa todo el proyecto (cliente HTTP, hooks, i18n, componentes de `ui`).
- `src/layouts`: AuthLayout, AppLayout y el menú.
- `src/features/<módulo>`: páginas, componentes y llamadas al backend de cada módulo.
- `src/locales/<idioma>/<módulo>.json`: traducciones, un namespace por módulo.

Una feature nunca importa de otra feature: lo común sube a `shared`.

## Reglas

- TypeScript estricto: nada de `any` ni de `@ts-ignore`. Los tipos se importan con `import type` (`verbatimModuleSyntax`).
- Todo texto que ve el usuario sale de i18next. Español rioplatense con voseo e inglés, siempre los dos.
- Los datos del servidor se piden con TanStack Query; no hay `useEffect` con `fetch`.
- Todas las llamadas al backend pasan por `shared/api/httpClient`, que agrega el token, el idioma y convierte los errores en `ApiError`.
- Los tokens viven en memoria. Nunca en `localStorage` ni en `sessionStorage`.
- Los permisos del front son solo para la experiencia de uso: quien decide es el backend.
- Estilos con Tailwind y los tokens de marca de `index.css`. Los componentes de `shared/ui` no traen colores propios.
- Los archivos en minúscula de `shared/ui` los genera la CLI de shadcn (`npx shadcn@4.21.0 add <componente> --yes`) y se editan lo mínimo, porque un `add` los vuelve a escribir. Los nuestros van en PascalCase. Por eso `.oxlintrc.json` apaga `react/only-export-components` solo para los generados: exportan su `cva` al lado del componente y es su forma, no un descuido. En los nuestros la regla sigue activa.
- Para combinar clases hay una sola función, `cn`, que viene del paquete `cn` (de shadcn) y se reexporta desde `shared/lib/utils`. No volver a agregar `clsx` ni `tailwind-merge`.
- Tests con Vitest y Testing Library, consultando por rol y texto accesible, no por clases CSS. Las llamadas HTTP se simulan con MSW.

## Rendimiento

- Las páginas de cada módulo se cargan con `lazy()` desde el router: cada ruta es su propio trozo del bundle.
- No se definen componentes adentro de otros componentes: se remonta todo el subárbol en cada render.
- El estado derivado se calcula durante el render, no con un `useEffect` que copia datos a otro estado.
- En condicionales de JSX se usa ternario, no `&&`, para no renderizar un `0` o un `""` sin querer.
- En `localStorage` va lo mínimo y con clave propia (`arquitecturabase.*`). Nunca tokens ni datos del usuario.
