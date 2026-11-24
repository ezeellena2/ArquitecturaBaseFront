# Información del negocio: el horario en una tabla y las zonas en dos columnas (IN1-C, IN2 e IN3)

Fecha: **2026-11-22**. Estado: **decidido el 2026-11-22, programado y probado a mano el 2026-11-24**, también sin
permiso y en sólo lectura, encima de los commits de la pieza única («Desplegables»). Sólo cambia el front: ni contratos
ni servidor. Falta la corrida completa del cierre; después el plan se retira con la auditoría documental.

## Por qué

Pedido del usuario el 22/11: «¿podemos poner los 2 últimos componentes abajo de ubicación y zona de entrega? o mejorar el
diseño de horario de atención, es bastante grande. No tiene una estructura estándar.»

Medido en la app a 1280 y 390 px: el horario mide 860 px en la compu y 1.150 de los 2.210 px del celular, y debajo de
Ubicación quedan unos 770 px vacíos. Cada día ocupa tres renglones, sin la estructura de una tabla. Una fecha especial se
lee corrida («25/12/2026 · Abierto · 09:00–13:00») y su fila lleva «Editar» con texto, contra la regla de las filas del
20/11. Con la pieza única, el horario crecería a unos 1.000 px en la compu y 1.780 en el celular.

Tableros: lienzo aparte [Información del negocio: reordenar](https://claude.ai/artifact/D3AdbHJK4ocZcHokKTVTrG), con
«IN · Hoy» (capturas reales), IN1-A, IN1-B, IN1-C, IN2 e IN3.

## Lo que se decidió

- **IN1-C.** Descartó IN1-A (sólo mover las zonas) e IN1-B (la tabla, con las zonas como hoy).
  - En la compu, debajo de «Datos del negocio», van dos columnas: a la izquierda Ubicación, Servicios y condiciones y
    Preguntas frecuentes; a la derecha, el horario.
  - En el celular, una zona debajo de la otra, en el orden de siempre: Datos, Ubicación, Horario, Servicios y Preguntas.
- **El horario en una tabla** (figura 1 de IN1-C).
  - La zona horaria va arriba.
  - La semana, en una tabla: Día · Horario · lápiz.
  - «Horario» dice las franjas, una por renglón, con «del día siguiente» si cierra pasada la medianoche. Si ese día no
    abre, dice «Cerrado» o «24 horas», o «Sin definir» en gris.
  - «Aplicar lunes a viernes» va debajo de la semana.
  - Las fechas especiales, en una tabla igual (Fecha · Horario · lápiz y tacho), en orden de fecha. Sin ninguna, sólo
    queda «Agregar fecha especial»: se va «Sin excepciones cargadas».
- **IN2, con un cambio.**
  - Un día se edita en el mismo diálogo que una fecha especial («Horario del lunes»), que abre el lápiz de su fila.
  - **La atención (Sin definir, Abierto, Cerrado, 24 horas) va en un desplegable, con la pieza única, y no en el
    segmentado.** Lo pidió el usuario el 22/11 y, preguntado si valía sólo para el horario o para toda la app, contestó
    «En toda la app». Reemplaza la regla de DS1-A que ponía de dos a cuatro opciones fijas en radios o un segmentado:
    elegir de opciones fijas también va en la pieza única. También en la carga de formularios: preguntado por el Sí o No y
    las hasta cinco opciones en fila de AR1-A, contestó «Sí, también». Y en los filtros: «los filtros también, todo en
    desplegable». Sólo queda afuera la vista previa que imita WhatsApp, porque muestra lo que le llega a la persona.
  - Los botones: «Agregar fecha» al crear una fecha especial; «Listo» al editar un día o una fecha.
  - Un problema se marca al tocar «Listo» y el diálogo no se cierra. Lo que cruza de un día al otro se revisa al guardar,
    debajo de la semana, como hoy.
- **IN3.**
  - Sin permiso, las tablas van sin la columna de los íconos y sin botones, y la zona horaria, apagada.
  - Con cuatro franjas o con 32 fechas, el botón se apaga con su motivo.
  - Mientras carga, cada zona dibuja su esqueleto en su lugar.
  - No cambian el conflicto con otro administrador, «Guardado por revisar» ni el aviso al guardar.

## Qué tiene que quedar

Igual a los tableros IN1-C (figuras 1 y 2), IN2 (figuras 1 a 6, con la atención en el desplegable de la figura 2) e IN3
(figuras 1 a 5). Al programar se abre cada tablero y se compara elemento por elemento
([revisión del cambio](../../../ArquitecturaBase/docs/guides/validar-un-cambio.md#antes-de-cerrar-lo-que-más-se-repite-en-las-revisiones)).

## Tareas

1. **`BusinessInformationPage.tsx`.**
   - La grilla de IN1-C: dos columnas desde `xl`, con áreas, así el celular conserva el orden.
   - Servicios y condiciones, con sus dos textos uno debajo del otro en la columna.
   - En Preguntas frecuentes, «Escribir otra pregunta» baja de renglón cuando no entra. Hoy, a 390 px, la etiqueta
     ocupa tres renglones y «Elegí una pregunta» se corta.
   - `FormSkeleton` dibuja las zonas de C.
2. **`BusinessHoursEditor.tsx`.** Primero, el test del texto de la columna «Horario» (franjas, día siguiente y estados).
   - La zona horaria arriba, en el `Picker` de `w-96`.
   - La tabla de la semana: `Surface` y los primitivos de tabla, con las filas alternadas.
   - El lápiz es un `IconButton` con `PencilIcon` y el nombre «Editar el horario del lunes».
   - «Aplicar lunes a viernes» va debajo de la tabla.
   - Las fechas especiales: `GroupLabel` y su tabla, con el lápiz («Editar el 25/12/2026») y el tacho («Quitar fecha
     25/12/2026»). «Agregar fecha especial» es `Button` `outline` `sm` con `PlusIcon`, apagado con su motivo en 32.
3. **Un solo diálogo para un día y para una fecha.** `SpecialDateDialog` pasa a servir a los dos.
   - El título, según el caso; la Fecha, sólo en una fecha especial.
   - La Atención, en un `Picker` de cuatro opciones; las franjas, como hoy.
   - Los botones, «Agregar fecha» o «Listo». Un día se valida al tocar «Listo», con los textos de hoy.
4. **Sólo lectura y límites** (IN3, figuras 1 y 4). El error entre días al guardar va debajo de la semana (figura 3).
5. **Textos es/en en `businessInformation.json`.** Se suman el título del diálogo de un día, «Listo», los encabezados
   Día, Fecha y Horario, los nombres de los íconos y «del día siguiente». Se quita `noExceptions`.
6. **Tests.**
   - `BusinessInformationPage.test.tsx`: las celdas por encabezado con `cellUnder`; editar un día; agregar, editar y
     quitar una fecha; un problema en el diálogo; la superposición al guardar; sólo lectura.
   - La escena visual `business-information.spec.ts` a 1440, 390 y 320 px, en español e inglés, rehecha con
     `--update-snapshots=all` y mirada una por una.
7. **Documentación.**
   - [El fundamento visual](../design/visual-baseline.md): «Información del negocio». La regla general de las opciones
     fijas la escribe «Desplegables» con la pieza única (ver Coordinación).
   - [Información del negocio guiada](../design/informacion-del-negocio-guiada.md).
   - Al cerrar, las fuentes de las [premisas](../../../ArquitecturaBase/docs/architecture/premisas-de-la-plantilla.md);
     el plan se retira con la auditoría documental.

## Coordinación

- **La copia de «Desplegables».** Sus 57 commits, sin aplicar todavía, cambian `BusinessHoursEditor.tsx` (el estado en
  segmentado, las horas y la zona en `Picker`) y `BusinessLocationEditor.tsx` (radios), y escriben la regla vieja de las
  opciones fijas en `visual-baseline.md`, `estandar-visual.md`, `premisas-de-desarrollo.md` y el plan de la pieza única.
  Con la regla del 22/11, esa sesión pasa en su copia los segmentados y radios de opciones fijas a la pieza y corrige
  esos documentos antes de aplicar, así no hay choques. Este plan se programa encima.
- **La URL.** Nada vive en la URL, como hoy.

## Verificación

- **Por tarea:** el build, oxlint, los tests del área y su escena visual.
- **Al cerrar:** la corrida completa ([validar un cambio](../../../ArquitecturaBase/docs/guides/validar-un-cambio.md#verificación-y-cierre)).
- **La prueba guiada con el usuario:** editar un día, una fecha que cierra pasada la medianoche, la superposición al
  guardar y el celular.

## Cómo quedó (2026-11-24)

- Igual a IN1-C, IN2 e IN3, con dos diferencias aceptadas:
  - Las filas de las tablas miden lo que mide toda fila (la regla de diseño no deja que una fila cambie su alto): en el
    celular no llegan a los 44 px que dibujaba el tablero.
  - El esqueleto de carga es el de siempre de la pantalla, sin las dos columnas.
  - En las filas alternas, «Sin definir» toma el color de esa fila, como todo texto gris en una tabla de la app.
  - A 320 px, una franja baja de renglón entre sus dos horas para que la semana entre en su zona; la tabla de fechas
    especiales, con dos íconos por fila, se desplaza de costado dentro de su recuadro.
- `BusinessHoursEditor.tsx` tiene un solo diálogo (`OpeningDayDialog`) para un día y una fecha especial, y la columna
  «Horario» sale de `Schedule`. `BusinessInformationPage.tsx` arma la grilla de IN1-C con áreas, así el celular conserva el orden.
- En Preguntas frecuentes, el desplegable conserva un ancho mínimo y «Escribir otra pregunta» baja de renglón en el celular.
- Pruebas: los 33 tests de la pantalla, los de arquitectura y diseño, y las escenas visuales `business-information`,
  `business-guided` y `comparisons` (33), con las capturas de la pantalla rehechas y miradas a 1440, 390 y 320 px.
- Prueba a mano (2026-11-24): la hizo en la app viva la sesión «Análisis arquitectónico de desarrollos», que hoy prueba
  el front a pedido del usuario, y todo coincidió con lo decidido:
  - IN1-C en la compu, y a 684 px una sola columna en el orden Datos, Ubicación, Horario, Servicios y Preguntas;
  - el horario: la zona arriba, la semana en su tabla, «Domingo · Cerrado», «Aplicar lunes a viernes» debajo y, sin
    fechas especiales, sólo «Agregar fecha especial»;
  - IN2: «Horario del lunes» con la atención y las horas en la pieza, «Agregar franja», «Cancelar» y «Listo»; la fecha
    especial, con «Agregar fecha»;
  - IN3: con cuatro franjas, «Agregar franja» apagado con «Podés agregar hasta 4 franjas.».
  Canceló todo sin guardar. No se probó la variante sin permiso, que necesita otra cuenta.
- Sin permiso (2026-11-24, con la Hotmail, rol Agrónomo, sin `ai.business.read`): el menú no ofrece Información del
  negocio y la ruta lleva a «No tenés permiso».
- Sólo lectura (2026-11-24): con el permiso del usuario, Agrónomo recibió «Ver información del negocio» sin «Administrar»
  sólo para la prueba y después volvió a sus tres permisos. Con la Hotmail, en la compu y a 581 px (el mínimo de la
  ventana de Chrome): «Sólo lectura» junto al título, sin Guardar ni Descartar; la semana con Día y Horario, sin la columna
  del lápiz; sin «Aplicar lunes a viernes» ni la zona de fechas especiales (no había ninguna); la zona horaria y
  «Dónde atendés» apagadas; a 581 px, una sola columna en el orden de siempre y sin desplazar de costado.
