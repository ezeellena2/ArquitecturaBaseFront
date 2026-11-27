# Usage: Consumo de IA y WhatsApp

Administración › Configuración › Consumo (`/configuracion/consumo?mes=yyyy-MM`, tablero CO1-B, [diseño](../../../docs/design/consumo.md)):
lo que gastaron la IA y WhatsApp en un mes del negocio, para calcular el costo de cada instalación. Las decisiones PR12 a PR16
están en el [plan del backend](../../../../ArquitecturaBase/docs/plans/2026-11-27-produccion-por-cliente.md).

## Al modificar

- **Una zona por módulo, con su permiso** (PR15): la de IA pide `ai.read` y el módulo `assistant`; la de WhatsApp,
  `settings.manage` y el módulo `whatsapp`. La ruta abre con cualquiera de los dos permisos y `UsagePage` decide las zonas;
  sin ninguna, `ForbiddenPage`. El menú repite la regla con `access` en `navigation.ts`. Un 403 de una zona la retira y relee
  `/api/me` (SP1-B). Los precios piden `ai.manage`.
- **El mes** (PR16) es el del negocio, en la zona horaria de la Configuración general (`currentMonth`); la lista ofrece los
  últimos 12 (`recentMonths`) y el actual no va en la dirección. Se escribe con `formatMonth` («11/2026»).
- **Cada zona carga por su cuenta** (`zoneLoading`), sin conservar el mes anterior al cambiar. La de WhatsApp es dueña de su
  aviso: «Meta no respondió» se reconoce por el `code` `WhatsApp.Usage.Unavailable` (500), nunca por el status, y el aviso
  lleva el `detail` del servidor. La de IA deja su aviso al manejador global.
- **Números y dinero** con `usageFormat` sobre `formatNumber` (dos decimales para importes, uno para minutos); la moneda va en
  el texto (`usage:usd`, `usage:money`). Lo que el proveedor no informa es «—» en gris, nunca cero.
- **Totales** en `usageModel`: la fila «Total» de la IA suma lo informado; «Total del mes» sólo con las dos zonas leídas,
  WhatsApp en USD y algún precio en la IA. Las categorías de Meta conocidas se traducen y una desconocida va como llega.
- **Precios** (`AiPriceDialog`, `priceDraft`): tres campos opcionales con la coma decimal en español, hasta 6 decimales y los
  topes del servidor (`priceLimits`). Un 409 (`Ai.ModelPrice.RevisionConflict`) o un guardado incierto siguen el recorrido N2
  (revisar, comparar, conservar o usar lo actual) y guardar invalida todos los meses.
- Los cuerpos de `src/test/fixtures/usage-http` están escritos a mano con las formas del plan hasta que el exportador del
  backend los reemplace.

## Referencias

- [Diseño elegido](../../../docs/design/consumo.md) y [fundamento visual](../../../docs/design/visual-baseline.md).
- Tests: `usageModel.test.ts`, `priceDraft.test.ts`, `pages/UsagePage.test.tsx`; escenas en `src/test/visual/usage.spec.ts`.
