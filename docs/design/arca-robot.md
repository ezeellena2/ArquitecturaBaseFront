# El robot de delegación de ARCA: tableros elegidos

Fecha: **2026-11-11**, con los tableros dibujados y elegidos el 2026-11-09. Estado: **programado** (front 5afcd50e, cde6d0dd, a197460a y dcf13351). El alcance y
las decisiones están en el [plan de la etapa 6](../../../ArquitecturaBase/docs/plans/2026-11-09-arca-etapa-6-robot.md), el
[ADR 0026](../../../ArquitecturaBase/docs/decisions/0026-robot-de-delegacion-arca.md) y la
[regla de ARCA](../../../ArquitecturaBase/docs/features/arca.md#delegación-con-robot-modo-3). Se apoya en la delegación guiada
de la etapa 5: el modo se elige en su zona «Datos» y, si el robot se frena, se sigue con su guía.

Origen: el lienzo provisorio [Formularios desde la app](https://claude.ai/artifact/Kvbr5KFJrGT951JLiu8i4M), filas «ARCA ·
robot» (RB1-A, RB1-B, RB2-A, RB2-B, RB3-A y RB3-B). Como el lienzo es privado y puede cambiar fuera de Git, este documento
congela lo elegido.

## Cómo leer los tableros

- Están dibujados a mano en escritorio, con la raíz al 75 % y el caparazón de AC1-A. Cada parte se arma con su pieza de
  `src/shared/ui` (tabla abajo), no copiando el dibujo.
- Los datos son ficticios: la empresa 20-00000006-0, la CUIL de quien entra 20-28456789-8, la plataforma «ArquitecturaBase»
  con la CUIT 30-71888777-8, el alias «arquitecturabase-demo» y el punto de venta 0005.

## Las elecciones

El usuario eligió RB1-A, RB2-A y RB3-A, más RB4-A (el aviso por correo, sin pantalla) y RB5-A (el robot también crea el
certificado de la plataforma). Descartó RB1-B (el consentimiento en un diálogo), RB2-B (el avance en una barra) y RB3-B (un
aviso con dos salidas y la guía desde el principio).

| Tablero | Qué define |
| --- | --- |
| **RB1-A · El consentimiento en la zona** (elegida) | La delegación automática es una zona más del alta. «Entrás con» (la CUIT de la empresa o la CUIL de quien administra sus relaciones; la (i) lo explica), «Clave fiscal» y una casilla que dice qué autoriza: «Autorizo a usar mi clave fiscal una sola vez para delegar «Facturación electrónica» en {plataforma} (CUIT …) y dar de alta un punto de venta de web service.», con su (i). «Delegar con el robot» en la banda, apagado sin la casilla, con el motivo «Marcá la autorización para seguir.». Un ingreso rechazado va debajo de la clave, que queda vacía: «ARCA no aceptó la CUIT o la clave fiscal. El robot no vuelve a probar solo.». |
| **RB2-A · El avance en pasos** (elegida) | La zona lista los pasos con su estado (hecho, en curso, pendiente) en dos columnas: «Con tu clave» (entrar a ARCA, delegar cada servicio, el punto de venta) y «Con la clave de {plataforma}» (crear el certificado de esta instalación, autorizar las consultas, aceptar la delegación, asignarla al computador fiscal y confirmar con ARCA). En curso, «En curso» junto al título. Esperando a la plataforma, «Falta que la plataforma acepte» con «Comprobar»; si la plataforma reintenta, el paso dice cuándo. |
| **RB3-A · La guía en el paso donde se frenó** (elegida) | La misma zona pasa a la guía de la etapa 5, abierta en ese paso, con lo hecho marcado «Lo hizo el robot» y el motivo en un aviso. «Probar otra vez con el robot» en la banda pide la clave de nuevo. Con un captcha o una validación extra, la guía arranca en el primer paso. |

## Lo que se fijó al registrar

Los tableros no lo dicen, o el contrato no lo permite; se resolvió con la opción más simple que cumple el diseño:

- **Cuándo aparece:** «Delegación automática» es una opción más de la elección del modo de la etapa 5, sólo si
  `GET /api/arca/connection/robot-runs/current` dice `enabled`. En el modo 3 no hay zonas de pedido ni de certificado: el
  robot las hace. Las zonas son Datos, Delegación automática, Prueba y una por familia elegida.
- **La clave:** un campo de contraseña sin autocompletar, que se vacía al enviar y al recibir un error; no se guarda en
  ningún estado fuera del campo ni en la URL. «Entrás con» valida el dígito de la CUIT antes de enviar.
- **El avance** se consulta cada dos segundos mientras algún lado corre o la plataforma espera con el cliente terminado; con
  la pantalla cerrada, el robot sigue igual. «Comprobar» corre la prueba de la conexión (la de la etapa 5) y vuelve a leer.
  Cada vez que un lado avanza, la pantalla vuelve a leer la conexión: el robot instala el certificado y confirma con la
  prueba, así que al terminar la prueba y Facturación se abren solas, y un reintento manda la revisión vigente.
- **Cuándo se va a la guía (RB3-A):** el lado del cliente frenado por captcha, validación extra, pantalla cambiada, ARCA sin
  responder o interrumpido. Un ingreso rechazado no abre la guía: el error va debajo de la clave (RB1-A). La guía abre en el
  paso que falló; con un captcha, una validación extra o una corrida interrumpida antes de entrar, en el primero.
- **Seguir con la guía (RB3-A):** la banda tiene «Probar otra vez con el robot» y «Verificar la delegación», el botón de la
  guía de la etapa 5. Con sus pasos hechos a mano, «Verificar la delegación» da por terminado el lado del cliente
  (`POST …/robot-runs/current/manual-completion`) y la zona vuelve al avance, con lo del cliente hecho y la plataforma
  aceptando, asignando y confirmando.
- **Si se frena la plataforma:** el cliente no vuelve a su guía, porque ese paso no lo puede hacer él. La zona dice «La
  plataforma tiene que terminar este paso a mano; ya le avisamos.» con «Comprobar», y el dueño recibe el correo (RB4-A).
- **La clave de la plataforma rechazada (H5):** el robot no la vuelve a probar solo, para que ARCA no la bloquee. La zona dice
  «ARCA no aceptó la clave de {plataforma}. El robot no la vuelve a probar solo, para que no la bloqueen: cuando la
  actualicen, tocá «Volver a probar la clave de la plataforma».» y quien administra ARCA tiene ese botón en la banda
  (`POST …/robot-runs/current/platform-rearm`): el lado de la plataforma vuelve a la espera.
- **Al terminar:** la zona se pliega con «Delegada · punto de venta 0005» y se abre la prueba. La zona de Facturación llega
  con ese punto de venta elegido.
- **Sin permiso de cambiar:** con `arca.read` y sin `arca.manage`, el avance se ve y el formulario no.

## Correspondencia con `shared/ui`

| Parte | Pieza |
| --- | --- |
| La zona | `ArcaZone` de la feature (sobre `Surface`) |
| «Entrás con» y «Clave fiscal» | `FormField` con `Input` (`type="password"` en la clave) |
| La autorización | `CheckboxField` con su (i) (`InfoTip`) |
| «Delegar con el robot» apagado | `Button` dentro de `DisabledReason` (MA1-A) |
| Los pasos | `StepList`, con el ícono del estado de cada paso |
| El motivo de la falla | `Banner` (`warning`) |
| La guía | el componente de la guía de la etapa 5, con el paso inicial y los pasos hechos |
