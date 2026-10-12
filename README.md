# ArquitecturaBaseFront

SPA de la plantilla base: React 19 + Vite 8 + TypeScript, con Tailwind 4, shadcn/ui, TanStack Query, react-router e i18next (español e inglés).

Es la cara del backend [ArquitecturaBase](../ArquitecturaBase), que resuelve el ingreso con código por correo o WhatsApp opcional, Google, OpenIddict, roles y permisos. Este repo no tiene backend propio: todas las llamadas van a esa Api. La portada pública `/` ofrece ingreso y, cuando el backend lo habilita, registro; con sesión muestra el tablero.

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

Aspire levanta Postgres, Redis, la Api y este front, y le pasa a Vite el certificado de desarrollo. El navegador habla con un solo origen, `https://localhost:5173`: Vite sirve el SPA y reenvía `/api`, `/account`, `/connect`, `/signin-google`, `/.well-known` y `/webhooks` a la Api (`vite.config.ts`, `server.proxy`). La Api queda en `https://localhost:7180`, pero no hace falta abrirla.

**Solo el front.**

```bash
npm run dev
```

Vite queda en `http://localhost:5173` (sin Aspire no hay certificado, así que es http) y reenvía el backend a `https://localhost:7180`, que tenés que levantar aparte. Sirve para trabajar en una pantalla suelta: el ingreso real no funciona por http, porque las redirect URIs registradas del cliente `web` son `https`.

## Scripts

Información del negocio usa un selector Leaflet/OSM que solicita mapas sólo al abrir su diálogo,
sin clave de Google ni búsqueda de direcciones. La plantilla pública opcional de build
`VITE_BUSINESS_MAP_TILE_URL` conserva por defecto las teselas estándar OSM. Para otro proveedor,
revisar atribución, licencia y acceso; nunca colocar secretos en variables VITE.
Consultar [contratos, migración y operación](../ArquitecturaBase/docs/features/inteligencia-artificial.md#editor-guiado-y-evolución-del-contrato).

| Comando | Qué hace |
|---|---|
| `npm run dev` | servidor de desarrollo con recarga en caliente |
| `npm run build` | `tsc -b` y después `vite build`; deja el resultado en `dist/` |
| `npm run lint` | Oxlint y tests de arquitectura visual de `src/test/architecture` |
| `npm run test` | Vitest, una corrida (`npm run test:watch` para el modo watch) |
| `npm run test:design` | solo los tests de arquitectura visual |
| `npm run test:visual` | Playwright: capturas, medidas, scroll y teclado; levanta y detiene Vite |
| `npm run test:visual:update` | actualiza capturas después de revisar una decisión visual autorizada |
| `npm run catalog` | catálogo de componentes reales y pantallas con datos ficticios en el puerto 5178 |
| `npm run preview` | sirve el `dist/` ya compilado |

Antes de dar algo por terminado, build, lint y test tienen que estar limpios. Un cambio visual también
ejecuta `test:visual`. Para preparar Chromium en otra instalación, ver el [estándar visual](docs/guides/estandar-visual.md#catálogo-y-revisión-con-navegador).

## Estructura

```
src/
  app/        composición: router, rutas y providers
  auth/       sesión OIDC, rutas protegidas y permisos
  shared/     cliente HTTP, hooks, i18n y la biblioteca de componentes (ui)
  layouts/    AuthLayout, AppLayout, menú lateral, barra superior
  features/   un módulo por área (auth, home, users, roles, settings, profile, errors, whatsapp), con sus páginas y llamadas
  locales/    traducciones, un archivo por idioma y módulo
  test/       arnés Vitest/MSW, reglas de arquitectura visual y catálogo/Playwright
```

Una feature nunca importa de otra: lo común sube a `shared`.

Para desarrollar pantallas, seguir las [premisas de desarrollo del front](docs/guides/premisas-de-desarrollo.md)
y el [fundamento visual aprobado](docs/design/visual-baseline.md). Estas reglas acompañan a la plantilla
en los proyectos derivados: las piezas comunes definen el aspecto y el comportamiento.

## Administración

Usuarios, roles y configuración, cada área detrás de su permiso:

| Ruta | Permiso | Qué hace |
|---|---|---|
| `/usuarios` | `users.read` (`users.manage` para las acciones) | listado, filtros y conteos, alta, edición de datos/roles, invitaciones, desvincular WhatsApp, activar, desactivar y eliminar |
| `/roles`, `/roles/nuevo`, `/roles/{id}` | `roles.read` para el listado; `roles.manage` para el editor y las acciones | listado, detalle, alta, edición de permisos y borrado |
| `/configuracion` | `settings.manage` | General: idioma, zona horaria, tamaño de listado y modo de registro, con un guardado conjunto |
| `/configuracion/apariencia` | `settings.manage` | colores globales con vista previa, revisión y restauración de Campo como borrador |

Las cuatro URLs anteriores `/configuracion/{idioma,zona-horaria,listados,registro}` redirigen a General.

Sin el permiso, el menú no muestra la entrada y entrar a mano a la ruta lleva a `/sin-permiso`. Quien decide, igual, es el backend: el front solo acomoda la interfaz.

Aparte de esas tres, cualquiera con sesión tiene **`/perfil`**: medios de ingreso (correo y WhatsApp),
nombre, idioma, zona horaria y último ingreso, desde "Mi perfil" en el menú del usuario. La oferta de
vincular WhatsApp depende del backend. El idioma guardado vale para la cuenta: al ingresar desde
otra máquina se aplica esa preferencia.

Con WhatsApp habilitado, `/whatsapp/chat` ofrece bandeja, historial y respuesta manual.
Requiere `whatsapp.read`; enviar pide además `whatsapp.send`, y tomar Manual desde un
contacto legado en Bot, `whatsapp.manage`. Una operación aceptada queda en cola durable;
no implica entrega. Reglas y verificaciones externas pendientes:
[WhatsApp](../ArquitecturaBase/docs/features/whatsapp.md).

## Producción

Con el módulo IA instalado y `ai.assistant.use`, Inicio ofrece consultas asistidas mediante
assistant-ui: fuentes verificables, historial propio, etapas y recuperación/cancelación durables.
El LLM usa la conexión guardada del backend; el navegador no recibe claves ni protocolos.
Sin módulo/permiso se conserva el Inicio base. El [contrato](../ArquitecturaBase/docs/features/inteligencia-artificial.md)
y [registro de entrega](../ArquitecturaBase/docs/reviews/2026-10-04-inicio-asistente.md)
distinguen automatización con handlers ficticios y piloto real pendiente.

`npm run build` deja el sitio estático en `dist/`. En producción lo sirve la Api desde su `wwwroot` (un solo origen, sin CORS). **Hoy no hay nada que copie `dist/` a `wwwroot`:** ese paso todavía no existe y lo tiene que resolver el pipeline de despliegue. La [guía de despliegue](../ArquitecturaBase/docs/guides/despliegue.md#front-dentro-de-la-imagen) explica el paso faltante; el [registro de pendientes](../ArquitecturaBase/docs/plans/verificacion-y-produccion.md) conserva su seguimiento.

## Diseño y planes

El [estándar visual aplicado](docs/guides/estandar-visual.md) define las piezas comunes y sus controles.
`npm run catalog` abre la referencia local; `npm run lint` detecta desvíos y `npm run test:visual`
compara escritorio, móvil y recorridos de teclado con las capturas versionadas.

- Diseño vigente: [fundamento visual](docs/design/visual-baseline.md) y [estándar aplicado](docs/guides/estandar-visual.md). El [diseño inicial](../ArquitecturaBase/docs/specs/2026-09-18-arquitectura-base-design.md) conserva el antecedente, con sus secciones reemplazadas identificadas.
- [Premisas de ambos repositorios](../ArquitecturaBase/docs/architecture/premisas-de-la-plantilla.md), [auditor documental](../ArquitecturaBase/docs/guides/auditar-documentacion.md) y [trabajo pendiente](../ArquitecturaBase/docs/plans/README.md). Los planes cumplidos se consolidaron; su [procedencia](../ArquitecturaBase/docs/history/README.md) se recupera desde Git.
- Reglas para agentes: [AGENTS.md](AGENTS.md); Claude importa la misma fuente desde [CLAUDE.md](CLAUDE.md).
- Convenciones completas: [docs/architecture.md](docs/architecture.md).
- Responsabilidades y guías por carpeta: [mapa de instrucciones](docs/mapa-de-instrucciones.md).
- [Auditoría documental del 2026-10-02](../ArquitecturaBase/docs/reviews/2026-10-02-auditoria-documental.md): alcance, checks y pendientes conservados.
- Premisas para todas las pantallas: [premisas de desarrollo](docs/guides/premisas-de-desarrollo.md).
- Mensajes en todas las pantallas: [contrato único](docs/guides/mensajes-y-estados.md) y
  [plan de adopción con inventario](docs/plans/2026-09-30-unificacion-mensajes.md).
