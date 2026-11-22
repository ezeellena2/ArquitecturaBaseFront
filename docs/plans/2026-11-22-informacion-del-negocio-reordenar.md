# Información del negocio: el horario en una tabla y las zonas en dos columnas (IN1-C, IN2 e IN3)

Fecha: **2026-11-22**. Estado: **decidido el 2026-11-22; sin programar.** Se programa con el front quieto (la prueba
integral terminada) y después de aplicar los commits de la pieza única («Desplegables»), que tocan los mismos archivos.
Sólo cambia el front: ni contratos ni servidor.

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
    segmentado.** Lo pidió el usuario el 22/11. DS1-A pone de dos a cuatro opciones fijas en un segmentado: esto es una
    excepción para el horario (el de un día y el de una fecha), salvo que el usuario la amplíe.
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
   - [El fundamento visual](../design/visual-baseline.md): «Información del negocio» y la excepción del desplegable en
     la atención.
   - [Información del negocio guiada](../design/informacion-del-negocio-guiada.md).
   - Al cerrar, las fuentes de las [premisas](../../../ArquitecturaBase/docs/architecture/premisas-de-la-plantilla.md);
     el plan se retira con la auditoría documental.

## Coordinación

- **La copia de «Desplegables».** Sus 57 commits, sin aplicar todavía, cambian `BusinessHoursEditor.tsx` (el estado en
  segmentado, las horas y la zona en `Picker`) y `BusinessLocationEditor.tsx` (radios). Este plan se programa encima, y
  el estado vuelve a un desplegable (`Picker`) sólo en el horario.
- **La URL.** Nada vive en la URL, como hoy.

## Verificación

- **Por tarea:** el build, oxlint, los tests del área y su escena visual.
- **Al cerrar:** la corrida completa ([validar un cambio](../../../ArquitecturaBase/docs/guides/validar-un-cambio.md#verificación-y-cierre)).
- **La prueba guiada con el usuario:** editar un día, una fecha que cierra pasada la medianoche, la superposición al
  guardar y el celular.
