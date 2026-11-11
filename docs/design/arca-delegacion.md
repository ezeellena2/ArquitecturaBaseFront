# La delegación en ARCA: tableros elegidos

Fecha: **2026-11-11**, con los tableros dibujados y elegidos el 2026-11-09. Es la etapa 5 de ARCA, la delegación guiada: la
empresa delega sus web services en la CUIT de la plataforma, que firma con su certificado. El alcance, las decisiones y las
fuentes oficiales de ARCA están en el [plan de la etapa](../../../ArquitecturaBase/docs/plans/2026-11-09-arca-etapa-5-delegacion-guiada.md);
la regla, en [ARCA](../../../ArquitecturaBase/docs/features/arca.md#delegación-guiada-etapa-5), y el
[ADR 0027](../../../ArquitecturaBase/docs/decisions/0027-delegacion-guiada-arca.md). Amplía la pantalla de
[la conexión con ARCA](arca-conexion.md): lo que no se dice acá sigue como allá.

Origen: el lienzo provisorio [Formularios desde la app](https://claude.ai/artifact/Kvbr5KFJrGT951JLiu8i4M), filas «ARCA ·
delegación» (DG1-A, DG1-B, DG2-A, DG2-B y DG3). Como el lienzo es privado y puede cambiar fuera de Git, este documento
congela lo elegido.

## Las elecciones

El usuario eligió DG1-A y DG2-A, y que la constancia de inscripción la consulte la plataforma con su CUIT, sin que la
empresa la delegue. Descartó DG1-B (dos tarjetas antes de las zonas) y DG2-B (un renglón por servicio con lo que falta).

| Tablero | Qué define |
| --- | --- |
| **DG1-A · El modo se elige en «Datos»** (elegida) | «Cómo se conecta» va primero en la zona 1, con «Certificado de la empresa» y «Delegación en ‹plataforma›». Con delegación, la CUIT es la de la empresa y el alias, el del certificado de la plataforma para esta instalación. La zona 3 pasa a «Certificado de la plataforma», con sus pasos bajo «Lo hace ‹plataforma›, con su clave fiscal», incluida la autorización de la constancia para el alias. La zona 4 pasa a «Delegación» en lugar de «Prueba». El punto de venta y «Activar la conexión» no cambian. Plegada, «Datos» dice «30-71000123-1 · Producción · Delegación en ‹plataforma›». |
| **DG2-A · La guía en dos listas** (elegida) | La zona «Delegación» separa «Lo hace la empresa, con su clave fiscal» (delegar cada servicio con la CUIT de la plataforma, que se copia con un toque, y dar de alta el punto de venta) de «Lo hace ‹plataforma›, con su clave fiscal» (aceptar en «Aceptación de Designación» y asignar al alias). «Verificar la delegación» en la banda corre la prueba; debajo, cada servicio dice si llegó. Con los servicios delegados la zona se pliega con su resumen y «Ver la guía» la vuelve a mostrar. |
| **DG3 · Estados** | Sin la plataforma configurada, «Delegación» apagada con su motivo (MA1-A). Un ticket viejo con ARCA que no da otro: «ARCA no acepta otro pedido hasta las …». En homologación, un solo paso de la plataforma en WSASS. La conexión activa: «Delegación» en lugar de «Servicios», con la plataforma, y «Certificado de la plataforma» en lugar de «Certificado»; si la empresa revoca, el aviso rojo y «Requiere atención». |

## Lo que se fijó al registrar

Los tableros no lo dicen, o el contrato no lo permite; se resolvió con la opción más simple que cumple el diseño:

- **«Verificar la delegación»** va con el estilo de «Probar», no como acción principal: la principal de la pantalla es
  «Activar la conexión».
- **La guía no se tilda a medias.** La prueba sólo ve el resultado de cada servicio, no cada paso: debajo de la guía va el
  estado de cada servicio, y la guía se pliega cuando todos los delegados responden.
- **«Lo hace la empresa»** no lleva la razón social: antes de la primera prueba no se conoce.
- **Sin plataforma configurada,** la opción dice «Delegación en la plataforma», apagada, con el motivo «La instalación no
  tiene configurada la CUIT de la plataforma.».
- **Cambiar el modo** en «Datos», como cambiar la CUIT o el ambiente, reemplaza la conexión del alta: se empieza de nuevo.
- **Los textos de cada servicio en delegación:** «Sin delegar» cuando el ticket no incluye a la empresa, «Sin asignar al
  alias ‹alias›» cuando el alias todavía no tiene el servicio, y «Con la CUIT de la plataforma» junto a la constancia.
- **Renovar** en delegación propone el mismo alias, porque las delegaciones siguen asignadas a él.
- **El aviso de revocada** sale de la prueba de esta visita: el servidor guarda sólo el resultado general.
- **Las claves de los pasos** (`platform.authorize.<servicio>`, `company.delegate.<servicio>`, `company.point-of-sale`,
  `platform.accept` y `platform.assign.<servicio>`) son las del robot de la etapa 6: la guía recibe el paso desde donde
  seguir y los pasos ya hechos con su rótulo, y así el robot la abre donde se frenó (RB3-A).

## Correspondencia con `shared/ui`

| En el tablero | Pieza |
| --- | --- |
| «Cómo se conecta» | `SegmentedControl`, con su ayuda en `InfoTip` y la opción apagada con `DisabledReason` |
| La guía en dos listas | `StepList` bajo un subtítulo por quien hace los pasos, en `DelegationGuide` de `features/arca/connection` |
| Copiar la CUIT de la plataforma | `IconButton` con `CopyIcon` |
| El estado de cada servicio | `ServiceRows` (`DataList` y `Badge`) |
| La plataforma en la conexión activa | Un renglón más de `DataList` |
| El aviso de revocada | `Banner` rojo |

Las escenas de `src/test/visual/arca.spec.ts` suman la delegación (`arca-delegation-*.png`).
