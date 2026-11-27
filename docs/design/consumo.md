# Consumo de IA y WhatsApp: el tablero elegido (CO1-B)

Fecha: **2026-11-27**. Para calcular cuánto cuesta cada cliente (una instalación por empresa), el titular pidió ver en su
instalación el consumo de la IA y de WhatsApp de cada mes. Eligió **CO1-B** el mismo día. El alcance y las decisiones
(PR12 a PR16) están en el plan [producción por cliente](../../../ArquitecturaBase/docs/plans/2026-11-27-produccion-por-cliente.md);
esta pantalla es su tarea T8.

Origen: el lienzo aparte [Consumo de IA y WhatsApp](https://claude.ai/artifact/JgHE2i54i9wFsGtcenGH1o), tableros
`OpcionB` (la pantalla), `Precios` (el diálogo) y `Estados`. El Sistema visual es de otra cuenta y el lienzo es privado y
puede cambiar fuera de Git: este documento congela lo elegido.

| Tablero | Qué define |
| --- | --- |
| **CO1-B · El resumen del mes arriba** (elegida) | Administración › Configuración › **Consumo**, último de la lista. La banda con «Consumo» y, a la derecha, «Mes» con el desplegable («11/2026»). Debajo, tres zonas a todo el ancho: «Resumen de 11/2026», «Inteligencia artificial» y «WhatsApp». |
| **Precios** | El lápiz de un modelo abre «Precios de gpt-6.1-sol»: Entrada y Salida (USD por millón de tokens) y Audio (USD por minuto), con Cancelar y Guardar. |
| **Estados** | Cargando (al entrar y al cambiar de mes), un mes sin pedidos a la IA, Meta que no responde (con «Reintentar»), la instalación sin número de WhatsApp, un mes sin mensajes informados, y los permisos, el mes y la dirección. |

## La pantalla

- **Menú y dirección:** `/configuracion/consumo?mes=2026-11`. El desplegable (la pieza para elegir) ofrece los últimos 12
  meses, el actual primero, escritos «11/2026» en los dos idiomas. Por defecto, el actual, que no va en la dirección (como
  todo valor por omisión); otro mes va en `mes`. El mes actual se cuenta en la zona horaria de la Configuración general
  (PR16): el servidor suma cada mes del negocio con la misma zona.
- **Resumen de 11/2026:** una celda por zona visible, con el nombre, el importe y su detalle en gris: «Inteligencia
  artificial» (lo estimado, «Estimado con tus precios»), «WhatsApp» (lo que informa Meta, «Según Meta») y «Total del mes»
  («Sólo si las dos van en dólares»), que aparece sólo cuando se ven y llegaron las dos zonas, WhatsApp está en USD y la IA
  tiene un costo estimado (no todos sus modelos del mes están sin precio; un mes sin pedidos cuenta cero).
- **Inteligencia artificial** (con la (i) del título: los tokens los informa el proveedor; el costo es una estimación con
  los precios cargados): la tabla de los modelos del mes, la fila «Total» y la nota en gris.
- **WhatsApp** (con la (i): mensajes entregados y costo según Meta, que los da como aproximados): «Número» con el número de
  la instalación, la tabla por tipo de mensaje, la fila «Total» y la nota en gris.

### Inteligencia artificial: una fila por modelo

| Columna | Qué va en la celda |
| --- | --- |
| Modelo | El nombre del modelo (`gpt-6.1-sol`) |
| Pedidos | Los pedidos que llegaron al proveedor, con los miles de su idioma (`1.284`) |
| Tokens de entrada | Los tokens informados (`2.315.400`); «—» en gris si el modelo no los informa |
| Tokens de salida | Igual que la de entrada |
| Audio | Los minutos con un decimal (`96,5 min`); «—» en gris si no hay audio |
| Costo estimado | `USD 4,76`; «Sin precio» en gris si el modelo no tiene precio cargado |
| (Acciones) | El lápiz «Precios de gpt-6.1-sol», sólo con `ai.manage` |

La fila **Total** suma pedidos, tokens y minutos (una columna sin ningún dato queda «—») y lleva el total estimado; si
ningún modelo tiene precio, «Sin precio». La **nota** dice, cuando corresponde, cuántos modelos sin precio no suman
(«Un modelo sin precio no suma al total.») y cuántos pedidos no informaron su uso («3 pedidos no informaron su uso y no
suman tokens.»), y siempre que el importe que cobra el proveedor está en su panel.

### WhatsApp: una fila por tipo de mensaje

| Columna | Qué va en la celda |
| --- | --- |
| Tipo de mensaje | La categoría de Meta traducida: Marketing, Marketing liviano, Utilidad, Autenticación (códigos de ingreso), Autenticación internacional, Atención (respuestas dentro de las 24 h) y Desde un anuncio. Una que no se conoce, como la manda Meta |
| Entregados | Los mensajes entregados (`2.480`) |
| Costo | El costo en la moneda de la cuenta (`USD 7,42`) |

La fila **Total** lleva los totales que manda el servidor. La nota: «Según Meta, en la moneda de la cuenta de WhatsApp.
Meta aclara que son aproximados; lo facturado está en su panel de pagos.»

### El diálogo de precios

«Precios de {modelo}» con tres campos opcionales, cada uno con su unidad al lado: Entrada y Salida («USD por millón de
tokens») y Audio («USD por minuto»). Se escriben con la coma decimal en español («1,25») y el punto en inglés; vacío es
«no cobra por eso». Cancelar y Guardar («Guardando…»); Guardar se apaga sin cambios. Un precio inválido va debajo de su
campo; un 409 sigue el recorrido de los editores con revisión (N2): el aviso con «Revisar valores actuales», la
comparación «Revisar cambios» en el diálogo, «Usar valores actuales» o «Conservar mis cambios» y otra vez Guardar.

### Estados

| Estado | Qué se ve |
| --- | --- |
| Cargando | Cada zona por su cuenta: la tabla con su encabezado y dos renglones de carga; en el resumen, el importe de esa zona |
| Un mes sin pedidos a la IA | En la zona, «En 10/2026 no hubo pedidos a la IA» |
| Meta no respondió (500 con `code` `WhatsApp.Usage.Unavailable`; se decide por el `code`, no por el status) | En la zona, «No pudimos leer el consumo de Meta» con «Reintentar»; el aviso de abajo dice la causa. La zona de la IA sigue andando |
| Sin número de WhatsApp | En la zona, «Esta instalación todavía no tiene un número de WhatsApp» |
| Un mes sin mensajes informados | En la zona, «En 10/2026 Meta no informa mensajes entregados» |
| Sin un permiso | La zona de la IA pide `ai.read` y el módulo de IA (`assistant`); la de WhatsApp, `settings.manage` y el módulo de WhatsApp. Con uno solo se ve sólo esa zona (y su celda del resumen); el lápiz pide `ai.manage`. Sin ninguno, «Consumo» no está en el menú y la dirección muestra «No tenés permiso» (SP1-B). Un 403 de una zona la retira y vuelve a leer los permisos |

## Lo que se fijó al registrar

Lo que el tablero no dice, o lo que las reglas de la app no dejan copiar tal cual; se resolvió con la opción más simple:

- **Sin leyendas** ([regla](visual-baseline.md#leyendas-y-carga--2026-11-01)): los vacíos y el error van sólo con su título
  (el tablero los dibujaba con una segunda línea que explicaba: «Elegí otro mes…», «Puede ser algo pasajero de Meta…»,
  «Cuando lo tenga…», «Meta guarda un año de historia.»); el diálogo va sin el párrafo debajo del título, y «Vacío: este
  modelo no cobra por minuto.» pasa a la (i) de Audio.
- **«Número»** se lee en `DataList`, no como un rótulo suelto con el número al lado ([lecturas](visual-baseline.md#lecturas)).
- **El lápiz** va en `RowActions`, como toda acción de una fila.
- **Las tablas no ordenan:** son el resumen de un mes, con su fila de total, como el tablero; no son listados.
- **El resumen** usa `StatCard` sin su borde (`flush`), con una línea entre celdas. Una zona que carga muestra el bloque de
  carga en su importe; con error o sin número, «—».
- **El 403 de una zona** la saca de la pantalla y relee `/api/me`, como una zona con permiso propio (SP1-B).

## Correspondencia con `shared/ui`

| Parte | Pieza |
| --- | --- |
| La banda y el mes | `Page` con `actions`; «Mes» nombra a `Picker` |
| Las zonas | `Surface` con título y `help` (la (i)) |
| El resumen | `StatCard flush` en una grilla |
| Las tablas | `Surface` con los primitivos de `table` (`numeric` en las columnas de números, `TableFooter` para el total) |
| El lápiz | `RowActions` con `PencilIcon` |
| «Número» | `DataList` |
| Carga | `Skeleton` en las filas y en el importe |
| Vacío, error y sin número | `EmptyState embedded`, con «Reintentar» en el error |
| El diálogo | `Dialog`, `FormField` con `beside` y `help`, `Input`, `Button pending` |
| El conflicto | `Surface` «Revisar cambios» con `ComparisonTable` y los textos de `common:revisionReview` |
| Sin permiso | `ForbiddenPage` |

Estado: elegido y registrado el 2026-11-27, antes de programar. Falta pasar el tablero al lienzo del sistema visual.
