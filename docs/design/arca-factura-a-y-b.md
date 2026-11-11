# La factura A y B: tableros elegidos

Fecha: **2026-11-11**, con los tableros dibujados y elegidos el 2026-11-09. Estado: **elegido, sin programar** (etapa 4 de
ARCA, tarea 7). El alcance, las normas y las decisiones están en el
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

## Pendiente

- Programar IV1-A, IV2-A e IV3 sobre el estándar «Factura» de la etapa 3 y su front (la zona «Comprobante», la anulación y
  el «¿La emito?»). Lo que se fije al programar se anota acá.
- La prueba a mano, en la prueba integral.
