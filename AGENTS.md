# ArquitecturaBaseFront: reglas para agentes

La guía canónica de arquitectura, flujo de trabajo y convenciones está en [`docs/architecture.md`](docs/architecture.md). Leela completa antes de modificar código. `CLAUDE.md` importa estas mismas instrucciones.

Para cualquier trabajo visual, de UX o de nuevas pantallas, leé además `docs/design/visual-baseline.md`. Ese documento es el contrato visual versionado compartido por Codex y Claude; el Artifact externo queda registrado allí como procedencia, no como única fuente.

Antes de desarrollar o modificar una pantalla, leé [`docs/guides/premisas-de-desarrollo.md`](docs/guides/premisas-de-desarrollo.md). Sus reglas de filtros, tablas, formularios, selección, botones, modales, errores y notificaciones valen para toda la plantilla y los proyectos derivados.

Los mensajes tienen un [contrato único](docs/guides/mensajes-y-estados.md), obligatorio en todas las
pantallas públicas y privadas, incluidos formularios y diálogos. Una feature no define su propia
política. La [adopción del código existente](docs/plans/2026-09-30-unificacion-mensajes.md) está pendiente:
seguir ese inventario; no declarar una pantalla unificada solo por documentarla o encontrar el texto
en un test. El diseño define canal, dueño y recuperación antes del desarrollo; el cierre requiere
pruebas de ubicación, duplicación y conservación del borrador, además de los checks generales.

Reglas adicionales:

- Antes de programar una pantalla nueva, dibujala como tablero en el Artifact del sistema visual (el enlace está en `docs/design/visual-baseline.md`) con su funcionalidad completa: estados de carga, vacío y error, qué pasa sin permiso, el recorrido de diálogos y qué vive en la URL. Se programa después de una elección explícita del usuario; programar primero y dibujar después no cuenta. El tablero arranca de una plantilla del lienzo y se arma con las piezas de la biblioteca ArquitecturaBase UI (el enlace también está en `visual-baseline.md`), no dibujadas a mano.
- No copies una maqueta a ciegas: contratos funcionales, permisos, accesibilidad, i18n y manejo de errores del repositorio tienen precedencia.
- Una pantalla resuelve una tarea, con menú por tema y cabecera clara; no acumular ajustes independientes
  en formularios largos. Resultados, errores generales, warning e info usan el único Toaster abajo a la
  derecha; validación junto al campo y decisiones en ConfirmDialog. El detalle está en el contrato de mensajes.
- Las decisiones aprobadas terminan en tokens de `src/index.css`, componentes de `src/shared/ui` y tests; no quedan solamente documentadas.
- Para explorar alternativas con la skill `variant`, acotá cada ronda a una pieza, usá tres variantes sobre un único eje y mantené el laboratorio aislado. No promociones ninguna sin elección explícita del usuario.
- Al promover una variante, integrá solo la elegida y eliminá el selector, el arnés y las descartadas.

## Lectura por carpeta

- Antes de editar, leé los `AGENTS.md` de las carpetas que contienen los archivos afectados, desde la raíz hasta el ámbito local. Leé todas las áreas cuando el cambio atraviesa varias.
- El [mapa de instrucciones](docs/mapa-de-instrucciones.md) explica los ámbitos y qué cubre cada padre. La [receta compartida](../ArquitecturaBase/docs/guides/instrucciones-por-carpeta.md) explica cómo agregar y mantener un par.
- Al crear una feature o mover una responsabilidad, actualizá su guía y el mapa junto al código; las guías complementan la arquitectura y el contrato visual.

## Reglas generales

- Trabajá directo en `main`; no crear ramas ni hacer push sin pedido explícito. Commits chicos, en español, con conventional commits.
- Antes de cerrar: `npm run build`, `npm run lint` y `npm run test`, los tres limpios. Si levantaste Aspire desde el backend, terminá con `aspire stop`.
- Una feature nunca importa otra. Lo compartido va en `src/shared`; router y providers, en `src/app`; sesión y guards, en `src/auth`; caparazón, en `src/layouts`.
- TypeScript estricto, textos de i18next en español e inglés, datos por TanStack Query y `shared/api/httpClient`. Los tokens viven en memoria.
- Los permisos del front son para la experiencia; el servidor autoriza. Las decisiones visuales se implementan con tokens y UI comunes.
