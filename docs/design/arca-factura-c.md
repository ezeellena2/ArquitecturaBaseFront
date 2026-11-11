# La factura C: tableros elegidos

Fecha: **2026-11-11**, con los tableros dibujados y elegidos el 2026-11-09. Estado: **programado el 2026-11-11** (etapa 3 de
ARCA, tarea 14; front 0815da57, 18e31307, 9da76575 y e7b7476c). El alcance y las decisiones están en el
[plan de la etapa 3](../../../ArquitecturaBase/docs/plans/2026-11-09-arca-etapa-3-factura-c.md); la regla vigente, en
[ARCA](../../../ArquitecturaBase/docs/features/arca.md). La A y la B suman lo suyo en [la factura A y B](arca-factura-a-y-b.md).

Origen: el lienzo provisorio [Formularios desde la app](https://claude.ai/artifact/Kvbr5KFJrGT951JLiu8i4M), filas «ARCA ·
factura C» (EM1, EM2, NC1 y CA1). Como el [Sistema visual](https://claude.ai/artifact/HPbmDPLnr8JZ9TxevtTqJJ) no se abre
desde la cuenta de Claude Code y el lienzo puede cambiar fuera de Git, este documento congela lo elegido.

## Cómo leer los tableros

- Dibujados a mano en escritorio, con la raíz al 75 % y los colores de `src/index.css`. Cada parte se arma con su pieza de
  `src/shared/ui`, no copiando el dibujo.
- Datos ficticios: una emisora monotributista, «Agro del Sur S.A.» (responsable inscripto), FAC-000012 y la Factura C
  00004-00000012 por $ 605.500,00.
- Mandan las reglas posteriores: fechas sólo con números, `09/11/2026` y no «9 nov 2026»
  ([regla](visual-baseline.md#fechas-sólo-con-números--2026-11-10)); el estado, una vez
  ([EP1-A](visual-baseline.md#el-estado-una-vez--2026-11-06)), y «Corregir» y «Anular» en ⋮, lo destructivo al final y en
  rojo ([AC1-A](visual-baseline.md#íconos-y-acciones)), aunque el tablero deje «Corregir» en el título.

## Las elecciones

El usuario eligió EM1-A, EM2-A y NC1-A; CA1 no tenía opciones. Descartó EM1-B (el comprobante debajo del paso de la
actividad), EM2-B (el total dentro del Flow, con el intercambio cifrado con Meta) y NC1-B (anulada al confirmar).

| Tablero | Qué define |
| --- | --- |
| **EM1-A · Una zona «Comprobante» arriba de todo** (elegida) | La primera zona del detalle, antes de «Respuesta». Datos sueltos de a cuatro: «Comprobante» (Factura C 00004-00000012), «Fecha», «CAE», «Vence el CAE»; «Cliente», «CUIT», «Condición frente al IVA», «Total». Su banda dice el estado de la emisión (abajo); el título, el de la respuesta. «PDF fiscal», con el ícono de bajar, va con los íconos del título ([TL3-A](formularios-whatsapp.md#la-actividad-y-el-encabezado-de-una-respuesta-tl3-a--2026-11-02)). La actividad sigue contando «Emitir comprobante en ARCA». El número es una columna para elegir en «Columnas» de la planilla (RE1-A, [motor para documentos](motor-para-documentos.md)). |
| **EM2-A · El «¿La emito?» en WhatsApp, un mensaje después del Flow** (elegida) | En la app, «Enviar» abre «¿Emitimos la factura?»: «Comprobante» Factura C con la (i) «Lo decide el sistema: sos monotributista», «Cliente», «Fecha» y «Total»; debajo, «Una vez emitida, sólo se anula con una nota de crédito.»; «Volver» y «Emitir factura». En WhatsApp, al terminar el Flow: «Factura C para Agro del Sur S.A. por $ 605.500,00, con fecha 09/11/2026.» y «¿La emito?», con «Emitir» y «No emitir». «Emitir» responde «Listo: emitimos la Factura C 00004-00000012.» con su PDF; «No emitir», «No la emitimos. FAC-000012 quedó anulada.» (motivo «No se emitió», nada va a ARCA). Sin respuesta, la emisión espera y quien cargó ve en el detalle «Esperando que lo confirmes» con «Emitir» y «No emitir». |
| **NC1-A · Anulada cuando ARCA autoriza la nota de crédito** (elegida) | ⋮ tiene «Anular con nota de crédito»: «¿Anular FAC-000012?», «Se emite en ARCA una nota de crédito C por $ 605.500,00 que anula la Factura C 00004-00000012. No se puede deshacer.», «Motivo \*», «Cancelar» y «Anular con nota de crédito», en rojo. Hasta la autorización, el título dice «Anulándose», sigue en la planilla y la zona suma «Nota de crédito» y «CAE de la nota» («—» sin número), con la banda «Emitiendo la nota» o «En cola». Autorizada, la banda dice «Anulada», «PDF fiscal» ofrece los dos y sale de la planilla ([CW11-A](carga-desde-la-app.md#corregir-y-anular-etapa-3--2026-11-05)). Rechazada, sigue «Emitida» con el aviso rojo «No se pudo anular» · «ARCA rechazó la nota de crédito: » con el código y el motivo, y se vuelve a anular. |
| **CA1 · Las tablas de ARCA, «Completar con ARCA» y los datos del comprobante** (sin opciones) | La carpeta del sistema «ARCA», con candado ([carpetas](carpetas.md)); columnas «Nombre», «Opciones», «Origen» («ARCA») y «Actualizado» («hace 2 h»). Sus catálogos no tienen «Agregar opción» ni importación; el título dice «Actualizado por ARCA hace 2 h», con una (i): lo actualiza ARCA una vez por día. Si falla, aviso amarillo «No se pudo actualizar» · «ARCA no responde. Los formularios siguen usando la copia del 08/11/2026; volvemos a probar en una hora.». En «Agregar cliente», «Completar con ARCA» (ícono de actualizar) junto a «CUIT \*» llena «Razón social \*», «Condición frente al IVA \*» y «Domicilio» (no «Correo»), que se pueden cambiar antes de «Listo». Errores: «Revisá la CUIT: el último dígito no corresponde.» (sin llamar a ARCA), «ARCA no responde» · «Probá de nuevo en un rato o completalo a mano.» y «ARCA no tiene esa CUIT.». |

## La banda de la zona «Comprobante»

| Estado | Qué muestra |
| --- | --- |
| Emitiendo | «ARCA está autorizando la factura. La página se actualiza sola.» Sin número ni acciones. |
| En cola | Aviso amarillo con reloj: «ARCA no responde» · «Volvemos a probar a las 10:45. Ya probamos 3 veces; te avisamos por WhatsApp.». |
| Emitida | Los ocho datos. |
| Rechazada | Aviso rojo con cruz: «ARCA rechazó la factura» · «10015 · El número de documento del receptor no es válido.» y «No se emitió nada. Corregí la respuesta y la factura sale con la corrección.». |
| Para revisar | Aviso amarillo y «Revisar»: «El número 00004-00000012 ya figura en ARCA con otros datos» · «Puede haber otro sistema usando el mismo punto de venta.», o «ARCA ya no acepta la fecha 02/11/2026» · «Con productos, la fecha puede estar hasta 5 días antes de hoy.». Sin «Emitir comprobantes en ARCA», «Lo resuelve alguien con «Emitir comprobantes en ARCA».» y sin «Revisar». |

«Revisar la emisión de FAC-000012» ofrece dos opciones, la primera marcada, con «Cancelar» y «Confirmar»: «Emitir con el
número siguiente» o «Emitir con la fecha de hoy», según el motivo, y «No emitir» («La respuesta queda anulada, sin
factura.»). Por el número, antes dice «Antes de decidir, mirá «Mis comprobantes» en ARCA.». Si otro la resolvió antes, lo
dice y se relee la actividad.

## Lo que el tablero no fija o ya cambió

- **«Esperando que lo confirmes»** no tiene dibujo; lo más simple es la banda de la zona, como los demás estados.
- **«En cola» y «Rechazada» al programarse (2026-11-11):** formularios no nombra módulos, así que los títulos los da el
  servidor. «En cola» dice «Todavía no se pudo emitir» · «Volvemos a probar a las 10:45. Ya probamos 3 veces.» (la fecha
  también, si no es hoy): el motivo de la espera pide probar más tarde y acá el sistema vuelve a probar solo. Sin intentos
  (una factura ya autorizada que espera su PDF) sigue «Emitiendo». Sin «te avisamos por WhatsApp»: el front no sabe por qué
  canal llega el aviso. El aviso lleva el ícono de su tono (AV1-A), no un reloj. «Rechazada» dice «No se emitió el
  comprobante» · el texto de ARCA que manda el servidor («10015 · …»); lo mismo «No se pudo anular».
- **El cliente nuevo** (decisión 4 del plan) tampoco: «Otro: escribir la CUIT» y, si ARCA no la tiene o no responde, el
  resumen lo dice con «Volver a probar» y «No emitir».
- **Los datos del comprobante** siguen AC4 ([conexión con ARCA](arca-conexion.md#ac4--datos-del-comprobante--2026-11-11)),
  ya programado: zona propia, sin completar la familia. CA1 los dibujó en «Facturación» con «Falta completar».
- **«Clases»** en la condición frente al IVA y **«en una hora»** son del dibujo: el catálogo trae código, texto y valor, y
  una falla se vuelve a leer a los 15 minutos.
- **CA1 al programarse (2026-11-11):** el contrato de un catálogo External no trae el nombre de su origen ni,
  en el listado, cuándo se actualizó, y formularios no nombra módulos. Por eso el origen dice «De otro sistema» (no «ARCA»),
  el listado no tiene la columna «Actualizado» y el título dice «Actualizado hace 2 horas» o «Actualizado el 08/11/2026»,
  con la (i) «Lo mantiene otro sistema, que lo actualiza una vez por día. No se edita a mano.». El aviso amarillo es
  «No se pudo actualizar.», con «El sistema que lo mantiene no responde.» si el código termina en `Unavailable`, y «Los
  formularios siguen usando la copia del 08/11/2026; volvemos a probar cada 15 minutos.». «Completar con ARCA» sí lleva el
  nombre, que manda el padrón; sus avisos van en el Toaster («ARCA no responde» · «Probá de nuevo en un rato o completalo a
  mano.», «ARCA no tiene esa CUIT.») y lo que está mal en la CUIT, debajo del campo: «Escribí la CUIT.», «Revisá la CUIT:
  son 11 números.» y «Revisá la CUIT: el último dígito no corresponde.». Para «ARCA» y «Actualizado» en el listado hace
  falta que el backend sume el nombre del origen y la fecha a la fila.
- **«Completar con ARCA» y el nombre largo (2026-11-11):** el nombre entero va en el campo «Razón social» de «Clientes»; el
  texto de la opción toma sus primeros 30 caracteres, como el cliente nuevo que el backend suma al emitir.

## Contratos del backend

Confirmación, vista previa, revisión y anulación:
[Emitir un documento — IssueDocument](../../../ArquitecturaBase/docs/features/formularios.md#emitir-un-documento--issuedocument-2026-11-09).
Catálogos, emisor, cola y PDF fiscal:
[Emisión de comprobantes](../../../ArquitecturaBase/docs/features/arca.md#emisión-de-comprobantes-etapas-3-y-4).

## Pendiente

- La prueba a mano, en la prueba integral.
