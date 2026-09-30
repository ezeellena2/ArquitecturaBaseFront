# Mapa de instrucciones del front

Relevamiento del 2026-09-30. Hay **22 ámbitos** con `AGENTS.md` y su `CLAUDE.md`. Cada enlace abre la guía del ámbito; el archivo de Claude importa esa misma fuente con `@AGENTS.md`.

## Cómo entrar a un desarrollo

Leé la raíz y después las guías de las carpetas que contienen los archivos que vas a cambiar, de mayor a menor alcance. Si una operación cruza áreas, leé cada área y la guía funcional enlazada. Una guía local complementa la raíz: no redefine la arquitectura.

Las reglas completas están en [architecture.md](architecture.md), las premisas de pantallas en [premisas-de-desarrollo.md](guides/premisas-de-desarrollo.md) y el contrato visual en [visual-baseline.md](design/visual-baseline.md). Antes había un ámbito en la raíz; las reglas generales de CLAUDE.md se conservaron en la guía canónica para compartirlas con cualquier agente.

Los mensajes tienen un [contrato transversal único](guides/mensajes-y-estados.md), heredado por
todas las áreas. El [plan de adopción](plans/2026-09-30-unificacion-mensajes.md) distingue la regla
vigente de la migración y los controles automáticos pendientes.

## Carpetas con guía propia

| Ámbito | Para qué sirve |
|---|---|
| [`./`](../AGENTS.md) | Reglas generales del front, lectura previa y entrada a las guías canónicas. |
| [`docs/`](AGENTS.md) | `architecture.md` conserva las reglas canónicas del front; `guides/premisas-de-desarrollo.md`, las premisas de todas las pantallas; `design/visual-baseline.md`, decisiones visuales aprobadas y procedencia; `mapa-de-instrucciones.md`, puntos de entrada por carpeta. |
| [`src/`](../src/AGENTS.md) | `app` compone la aplicación; `auth` maneja sesión y permisos; `layouts` contiene el caparazón; `features` agrupa producto; `shared` comparte mecanismos y UI; `locales` traduce; `test` contiene el arnés. |
| [`src/app/`](../src/app/AGENTS.md) | Monta providers, router y árbol de rutas. |
| [`src/auth/`](../src/auth/AGENTS.md) | Contiene configuración y proveedor OIDC, sesión actual, renovación, guards, permisos, nombre de cuenta y preferencia de idioma. |
| [`src/features/`](../src/features/AGENTS.md) | Cada área contiene páginas, componentes, API y errores propios. |
| [`src/features/auth/`](../src/features/auth/AGENTS.md) | Muestra bienvenida pública, ingreso, registro, código, enlace de un solo uso y callback. |
| [`src/features/errors/`](../src/features/errors/AGENTS.md) | Contiene pantallas de sin permiso y ruta inexistente. |
| [`src/features/home/`](../src/features/home/AGENTS.md) | `DashboardPage` muestra el inicio para quien tiene sesión. |
| [`src/features/profile/`](../src/features/profile/AGENTS.md) | Muestra medios de ingreso y datos del perfil. |
| [`src/features/roles/`](../src/features/roles/AGENTS.md) | Contiene catálogo/listado, alta y edición en ruta propia y selector de permisos por área. |
| [`src/features/settings/`](../src/features/settings/AGENTS.md) | Muestra y modifica los ajustes funcionales publicados por el backend. |
| [`src/features/users/`](../src/features/users/AGENTS.md) | Muestra listado, filtros y conteos, alta, edición de roles, estado de medios de ingreso e invitaciones. |
| [`src/layouts/`](../src/layouts/AGENTS.md) | Define layouts de acceso, inicio y aplicación autenticada, además de barra, menú, sidebar y migas. |
| [`src/locales/`](../src/locales/AGENTS.md) | Los JSON de `es` y `en` comparten un namespace por módulo. |
| [`src/shared/`](../src/shared/AGENTS.md) | Contiene cliente y contratos HTTP comunes, hooks, utilidades, i18n y sistema de UI. |
| [`src/shared/api/`](../src/shared/api/AGENTS.md) | `httpClient` agrega token e idioma, coordina renovación y transforma ProblemDetails en `ApiError`. |
| [`src/shared/hooks/`](../src/shared/hooks/AGENTS.md) | Agrupa estado de URL, paginado, filtros, foco, migas, cuenta regresiva y guardas de salida. |
| [`src/shared/i18n/`](../src/shared/i18n/AGENTS.md) | Configura i18next, carga namespaces y aplica idioma, preferencia local y `lang` del documento. |
| [`src/shared/lib/`](../src/shared/lib/AGENTS.md) | Contiene formato de fechas por zona, nombres de países y `cn`. |
| [`src/shared/ui/`](../src/shared/ui/AGENTS.md) | Reúne primitivas generadas por shadcn y componentes propios de formularios, tablas, diálogos, navegación y presentación. |
| [`src/test/`](../src/test/AGENTS.md) | `setup.ts` prepara Vitest/jsdom y MSW; `mocks` contiene servidor y contratos simulados; `utils` renderiza con providers y router de la app. |

## Carpetas cubiertas por su ámbito padre

Las páginas, API, componentes y utilidades internas de una feature siguen su guía de área. Los componentes individuales de UI siguen shared/ui; los idiomas siguen locales. Los documentos de diseño y las recetas siguen docs/AGENTS.md.

No se crean pares en `bin`, `obj`, `node_modules`, `dist`, `artifacts`, archivos individuales ni carpetas vacías. Un subámbito nuevo se justifica por una responsabilidad o riesgo que el padre no explica suficientemente.

## Mantenimiento

Cuando agregues un área, adaptador o cambio de responsabilidad, actualizá su guía y este mapa en el mismo desarrollo. Seguí la [receta de instrucciones por carpeta](../../ArquitecturaBase/docs/guides/instrucciones-por-carpeta.md). La enumeración es un punto de entrada, no un inventario de cada método.
