# La factura A y B: tableros elegidos

Fecha: **2026-11-11**, con los tableros dibujados y elegidos el 2026-11-09. Estado: **programado el 2026-11-11** (etapa 4
de ARCA, tarea 7); falta la prueba a mano. El alcance, las normas y las decisiones están en el
[plan de la etapa 4](../../../ArquitecturaBase/docs/plans/2026-11-09-arca-etapa-4-factura-a-y-b.md); la regla vigente, en
[ARCA](../../../ArquitecturaBase/docs/features/arca.md). Las pantallas, los textos y los estados de la A y la B salen de acá.

Origen: el lienzo provisorio [Formularios desde la app](https://claude.ai/artifact/Kvbr5KFJrGT951JLiu8i4M), filas «ARCA ·
factura A y B» (IV1-A, IV1-B, IV2-A, IV2-B e IV3), debajo de las de la factura C (EM, NC y CA). Se armó aparte porque el
[Sistema visual](https://claude.ai/artifact/HPbmDPLnr8JZ9TxevtTqJJ) no se abre desde la cuenta de Claude Code. Como el lienzo
es privado y puede cambiar fuera de Git, este documento congela lo elegido.

## Cómo leer los tableros

- Sólo dibujan lo que la A y la B cambian sobre la factura C. Lo demás (la carga, la zona «Comprobante», la anulación y el
  «¿La emito?» de la C) es de los tableros EM, NC y CA.
- Están dibujados a mano en escritorio, con la raíz al 75 % y los colores de `src/index.css`. Cada parte se arma con su
  pieza de `src/shared/ui`, no copiando el dibujo.
- Los datos son ficticios: «Agro del Sur S.A.» (responsable inscripto), un consumidor final, semilla al 21 %, fertilizante al
  10,5 % y un manual exento.

## Las elecciones

El usuario eligió IV1-A e IV2-A. Descartó IV1-B, el IVA y el importe con IVA en cada ítem, e IV2-B, una zona «Factura» en el
editor con «Los precios se cargan: Sin IVA · Con IVA».

| Tablero | Qué define |
| --- | --- |
| **IV1-A · La alícuota en cada ítem y el IVA en el total** (elegida) | La tabla de ítems de la «Factura» suma una columna «Alícuota»: una lista que viene en 21 %, con las alícuotas de ARCA (21 %, 10,5 %, 27 %, 5 %, 2,5 % y 0 %) más «Exento» y «No gravado». El IVA no se repite por ítem. La (i) del encabezado «Precio unitario» dice «Sin IVA: la factura le suma el de su alícuota» o «Con IVA», según el formulario. La zona «Total» discrimina: neto gravado, el IVA de cada alícuota, lo exento, lo no gravado y el total, en una grilla de valores; lo recalcula el servidor al enviar. La carga no cambia con el cliente: si sale A o B lo decide el sistema y lo dice el «¿La emito?». |
| **IV2-A · «El precio incluye IVA» en la pregunta «Precio unitario»** (elegida) | En el editor del formulario «Factura», la pregunta atada «Precio unitario» del bloque de ítems suma la casilla «El precio incluye IVA», debajo de «Se carga varias veces». Su (i): «Marcala si cargás precios finales, como en un mostrador: la factura separa el IVA de cada alícuota.». Sin marcar, los precios son netos. |
| **IV3 · El «¿La emito?» con IVA y los ítems en WhatsApp** (sin opciones) | El «¿La emito?» de EM2-A suma, en la A, el neto gravado, el IVA y lo exento antes del total, y la (i) de «Factura A» dice «Lo decide el sistema: sos responsable inscripto y tu cliente también». En la B a consumidor final, el IVA contenido y el total, con la (i) «Lo decide el sistema: es consumidor final». En WhatsApp, la pantalla de cada ítem suma la lista «Alícuota» y el resumen agrega el IVA entre paréntesis. |

## El PDF

No tiene tablero: el diseño fijo es el de la factura C y el contenido lo fija la norma (RG 1415, RG 5003 y RG 5614). Se
revisó con dos muestras dibujadas por el renderer real. La regla está en [ARCA](../../../ArquitecturaBase/docs/features/arca.md).

## Lo que se fijó al programar

- **El «¿La emito?» de la app** (EM2-A con IV3) es `components/IssueConfirmDialog.tsx`: la carga con `issuePreview` pide al
  tocar «Enviar» la vista previa del emisor (`POST api/forms/entries/{id}/issue-preview`) y abre el resumen; «Emitir factura»
  manda el envío de siempre. Los importes, sus etiquetas y la (i) los trae el emisor, así que la A, la B y la C usan el mismo
  diálogo. Si el emisor no puede (un cliente que ARCA no tiene, ARCA sin responder), el diálogo dice su mensaje con «Volver a
  probar».
- **El total discriminado de IV1-A** es `components/IssueTotals.tsx`, debajo de las preguntas: la misma vista previa, pedida un
  momento después de que la carga deja de cambiar y sólo cuando no falta nada. Los cálculos del formulario no saben el
  porcentaje de cada alícuota (se calculan al enviar), así que el desglose sale del emisor. La C no discrimina: no hay zona.
- **La acción en el editor de reglas** (`FormRulesSection`): cada emisor del formulario es un tipo de acción con su nombre;
  vale al recibir o al aprobar, una por regla y antes de los mensajes, y los mensajes que siguen suman en «Agregar dato» el
  grupo «De «…»» con los datos de su resultado. «Mandar copia por correo» (`SendCopy`, de la etapa 3) aparece en un formulario
  con emisor: es un mensaje como un aviso, sin rol ni PDF, que va después de «Emitir comprobante» en su regla y admite sus datos.
- **IV2-A (2026-11-11).** La casilla es genérica: el estándar declara en la pregunta atada sus casillas (`toggles`: clave, texto y
  (i) por idioma y el valor con que empiezan) y el editor dibuja una por cada una con el texto del estándar, sin textos propios
  en `forms.json`. «El precio incluye IVA» llega al emisor como el dato `pricesIncludeVat` («true» o «false»).
- **IV1-A, la alícuota en 21 % (2026-11-11).** El estándar declara por código la opción con que empieza «Alícuota» (el 5); la
  carga la trae elegida en cada ítem nuevo y se puede cambiar. WhatsApp no la muestra elegida: el emisor toma 21 % si falta.
- **IV1-A, la (i) de «Precio unitario» (2026-11-11).** La casilla declara también lo que dice la carga con cada valor
  (`whenOff`: «Sin IVA: la factura le suma el de su alícuota.»; `whenOn`: «Con IVA: la factura separa el de su alícuota.») y
  el servidor lo suma a la ayuda de la pregunta. En la tabla de ítems, la ayuda de cada pregunta va en la (i) de su columna.

## Pendiente

- La prueba a mano, en la prueba integral.
