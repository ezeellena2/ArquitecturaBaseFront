# La conexión con ARCA: tableros elegidos

Fecha: **2026-11-05**, con los tableros dibujados del 2026-11-01 al 2026-11-03. Estado: **programado** (Etapa 1, tarea 9). El
alcance y las decisiones están en el [diseño de la etapa](../../../ArquitecturaBase/docs/plans/2026-11-03-arca-etapa-1-conexion.md)
y en el [ADR 0025](../../../ArquitecturaBase/docs/decisions/0025-familias-de-servicios-arca.md). Las pantallas, los textos y los
estados salen de acá.

Origen: el lienzo provisorio [Formularios desde la app](https://claude.ai/artifact/Kvbr5KFJrGT951JLiu8i4M), filas «ARCA ·
conexión» (AC1-A, AC1-B, AC2-A, AC2-B y AC3). Se armó aparte porque el [Sistema visual](https://claude.ai/artifact/HPbmDPLnr8JZ9TxevtTqJJ)
no se abre desde la cuenta de Claude Code. El 2026-11-05 el usuario decidió registrar acá el diseño y programar, como con
renglones y la IA; los tableros pasan a ese lienzo cuando se pueda abrir. Como el lienzo es privado y puede cambiar fuera de
Git, este documento congela lo elegido.

## Cómo leer los tableros

- Están dibujados a mano en escritorio, con la raíz al 75 % y los colores de `src/index.css`. Cada parte se arma con su
  pieza de `src/shared/ui` (tabla abajo), no copiando el dibujo.
- Los datos son ficticios: «Agropecuaria Los Tilos S.A.», la CUIT 30-71000123-1, el alias «arquitecturabase» y los puntos
  de venta 0005, 0007 y 0003 (bloqueado). Las escenas visuales usan «Campo del Sur SA» y el alias «plataforma».
- AC3 muestra sólo el área principal; vale para AC1-A y AC2-A.

## Las elecciones

El usuario eligió AC1-A y AC2-A. Descartó AC1-B, el alta como asistente en un diálogo, y AC2-B, la conexión activa como una
ficha con historial.

| Tablero | Qué define |
| --- | --- |
| **AC1-A · El alta en la misma página, por zonas** (elegida) | Cinco zonas numeradas: 1 Datos, 2 Pedido de certificado, 3 Certificado, 4 Prueba y una por familia elegida (5 Facturación · Punto de venta). La zona en curso está abierta, las hechas quedan plegadas con su resumen en la banda y las siguientes, apagadas. Se puede salir y volver. **Datos:** CUIT con el dígito validado, ambiente (Homologación o Producción), alias y «Servicios que usa», con la constancia de inscripción marcada y fija; «Generar el pedido» no llama a ARCA. Plegada: «30-71000123-1 · Producción · alias «arquitecturabase»» con «Cambiar». **Pedido**, plegado, con «Descargar de nuevo». **Certificado:** «Abrir ARCA» en la banda, la lista de lo que se hace en ARCA (agregar el alias con el pedido en «Administración de certificados digitales», descargar el certificado y autorizar en «Administrador de relaciones» los servicios elegidos) y la zona punteada «Arrastrá el certificado (.crt) o» con «Elegir archivo»; si el certificado está bien, prueba solo. **Prueba:** cada servicio con «Responde» y «Ticket vigente hasta las 21:12», o por qué falla, «Probar de nuevo» en la banda y los datos de la empresa (razón social, CUIT, condición frente al IVA y domicilio fiscal). **Punto de venta:** los de web service, el bloqueado apagado, y «Activar la conexión» junto al título, que se habilita con todo completo. |
| **AC2-A · La conexión activa, por zonas** (elegida) | El estado y el ambiente junto al título y «Desconectar» en rojo. **Empresa** con los datos del padrón y la CUIT. **Servicios:** cada uno con «Lo usa esta empresa» (el padrón, fijo), «Probar» y la hora de la última prueba en la banda. **Certificado:** alias y vencimiento, con «Renovar». **Facturación · Punto de venta:** el número, con «Cambiar». Renovando: el aviso amarillo treinta días antes, «Actual» con su vencimiento, «Nuevo» con «Pedido generado · falta el certificado», y «Descargar el pedido», «Subir el certificado» (principal) y «Cancelar la renovación». |
| **AC3 · Estados y recorrido** | Sin conexión, «Conectar con ARCA» (sin `arca.manage`, el mismo vacío con «Solo lectura»); cargando, las zonas con su esqueleto; no se pudo leer, «No pudimos leer la conexión.» con «Reintentar»; probando, el botón ocupado; un servicio sin autorizar, «Falta autorizar el servicio para el alias «…»» y «Requiere atención»; un certificado que no corresponde, el motivo junto a la carga; vencido, el aviso rojo con «Renovar»; sin puntos de venta de web service, «ARCA no devolvió puntos de venta de web service para esta CUIT.» con «Volver a buscar»; un 409, la zona «Revisar» con «Leer lo actual»; desconectar, «¿Desconectar ARCA?» con lo que se borra. Nada vive en la URL. |

## Lo que se fijó al registrar

Los tableros no lo dicen, o el contrato no lo permite; se resolvió con la opción más simple que cumple el diseño:

- **El estado de cada servicio** sale de la prueba de esta visita. El servidor guarda sólo el resultado general y la hora,
  y un servicio sumado después de la última prueba no se probó: al volver a la pantalla, los renglones quedan sin estado
  (la banda dice cuándo se probó y el título, si la conexión está activa), y «Sin probar» aparece sólo si nunca hubo una
  prueba.
- **Los resúmenes plegados** dicen lo que el contrato tiene: el pedido, «Pedido generado para el alias «…»» (no guarda la
  fecha); el certificado, «Vence el …» (no guarda el nombre del archivo).
- **El punto de venta** muestra el número y el tipo de emisión que devuelve `FEParamGetPtosVenta`, que no trae domicilio;
  con la conexión activa, sólo el número, que es lo que se guarda.
- **«Activar la conexión»** aparece desde que el certificado está cargado (Sin verificar), apagado hasta que la prueba sale
  en verde y cada familia elegida completó su zona. Al tocarlo, cada familia guarda lo suyo (el punto de venta) y el
  servidor activa la conexión.
- **«Cambiar» en Datos** con otra CUIT u otro ambiente reemplaza la conexión del alta: se empieza de nuevo.
- **El estado** va con `Badge` en `Page.status`, como en el resto de las pantallas; el tablero dibuja un punto y el texto.
- **Fechas y horas** en el formato de la app y en el huso de la persona («31/10/2028», «9:10»).
- **Los errores de ARCA de una acción** (no los de la prueba) van al aviso común con el texto del servidor.
- **En el celular** las bandas apilan su acción debajo del título y los renglones bajan el valor; a 320 px nada desborda.

## AC4 · Datos del comprobante — 2026-11-11

Ingresos brutos e inicio de actividades van en el PDF de cada factura y el padrón de ARCA no los trae: se cargan a mano.
No hubo elección: el [tablero AC4](evidence/arca-ac4/ac4-tablero.png) sigue a AC2-A, por zonas, y quedó registrado acá
cuando se cerró la etapa 1, a pedido del chat que coordina la tanda del 11/11.

- **Dónde:** una zona propia, «Facturación · Datos del comprobante», debajo de «Facturación · Punto de venta», sólo con la
  conexión activa. No es un paso del alta: no completa la familia ni frena «Activar la conexión».
- **Lectura:** `DataList` con «Ingresos brutos» e «Inicio de actividades», el día sólo con números (dd/MM/yyyy). Lo que
  falta dice «Sin cargar». La (i) explica para qué son: «Van en el PDF de cada factura. El padrón de ARCA no los trae.»
- **Editar:** en la banda, «Cargar» si no hay ninguno o «Cambiar» si ya hay algo. Abre los dos campos con lo guardado,
  uno debajo del otro, con «Cancelar» y «Guardar»; «Guardar» se habilita cuando cambia algo. Un número vacío o de más de
  30 caracteres y una fecha vacía se marcan en su campo, con el foco en el primero, sin llamar al servidor; si el
  servidor rechaza uno, el error va al mismo campo. Lo demás va al Toaster, como en el resto de la conexión.
- **Sin `arca.manage`:** la lectura, sin botones.
- **Código:** `VoucherDataSection` e `InvoicingSections` en `features/arca/invoicing`, sobre
  `PUT /api/arca/invoicing/voucher-data`; `VoucherDataSection.test.tsx` fija los tres casos.

## Correspondencia con `shared/ui`

| En el tablero | Pieza |
| --- | --- |
| Zona con número, banda y resumen plegado, apagada o abierta | `Surface`, por `ArcaZone` de `features/arca/connection` |
| Estado y ambiente | `Badge` en `Page.status` |
| Datos de la empresa, servicios, certificado, punto de venta activo y datos del comprobante | `DataList` |
| Ingresos brutos e inicio de actividades al editar | `FormField` con `Input` (el inicio, `type="date"`) |
| Ambiente | `SegmentedControl`, con su ayuda en `InfoTip` |
| «Servicios que usa» | `CheckboxField` |
| Lo que se hace en ARCA | `StepList` |
| Soltar o elegir el .crt | La zona punteada de `EntryFilesField`, con `Button` |
| Puntos de venta | `RadioGroupField` |
| «Lo usa esta empresa» | `Switch` |
| Avisos de vencimiento | `Banner`, amarillo o rojo |
| «Revisar» | `Surface` con «Leer lo actual» |
| «¿Desconectar ARCA?» | `ConfirmDialog` |
| Sin conexión y no se pudo leer | `EmptyState` |
| Cargando | `Skeleton` |

Las escenas `arca-empty`, `arca-setup`, `arca-unverified`, `arca-active`, `arca-renewal` y `arca-read` de
`src/test/visual/arca.spec.ts` guardan las capturas `arca-*.png`.
