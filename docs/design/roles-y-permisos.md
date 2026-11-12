# Roles y permisos: la matriz (RO1-A)

Fecha: **2026-11-11**. Estado: **elegida la RO1-A el 2026-11-11 y programada el mismo día**; faltan la prueba manual y
pasar los tableros al lienzo del sistema visual.

El 2026-09-28 el usuario rechazó el diseño del front por parecer hecho por IA. Fue explícito: «los colores son lo de
menos». Lo delataban la escala y las formas repetidas de plantilla, y sus referencias son Vercel y DigitalOcean. De Roles
dijo que el selector de permisos ocupando media pantalla «no se parece a nada de la vida real». El rediseño quedó
pendiente; el 2026-11-07 pasó a después de la prueba integral y el 2026-11-11, con «Todo antes de la prueba», volvió a
antes.

Los tableros están en el lienzo aparte [Roles y permisos: rediseño](https://claude.ai/artifact/MDJUPkopujPycib3mnFqcc),
porque el Sistema visual no se abre desde Claude Code. Están dibujados con los tokens de la app y no armados con la
biblioteca, que tampoco se abre desde esta cuenta (la misma diferencia aceptada de los otros lienzos aparte).

## Los tableros

| Tablero | Qué define |
| --- | --- |
| RO · Hoy | La captura del editor con el selector anterior. Tenía una barra de filtros entera (buscador, «Todos · Elegidos», «Expandir todo») para 29 permisos y la descripción en media pantalla. Las áreas se plegaban, y Admin tenía 29 casillas apagadas y «Todos los permisos» en la banda. |
| **RO1-A · Matriz** (elegida) | Una fila por área con Ver, Administrar y «Otros permisos», como los permisos de DigitalOcean. Con todos los módulos son 13 filas y el rol entero entra en una pantalla. |
| RO1-B · Un nivel de acceso por área | Un segmentado Ninguno · Ver · Administrar por área, como los tokens de GitHub, con la regla nueva «Administrar incluye Ver». Descartada. |
| RO1-C · Lista de áreas y sus permisos | Como «Campos de…»: las áreas a la izquierda con «3 de 4», y los permisos del área abierta con su descripción a la vista. Descartada: para revisar un rol hay que abrir área por área. |
| RO1 · En el celular | Las tres a 390 px y la A también a 320. |
| RO2 · Estados y recorrido | Sobre la A: el listado (sin cambios), eliminar, carga, error, sin permiso, alta, carga y errores del rol, Admin, User, guardar, salir con cambios, el recorrido y la lista de chequeo. |

## La regla

- **Las columnas.** «Ver» es el permiso `<área>.read` y «Administrar», el `<área>.manage`. Lo demás va en «Otros
  permisos», con su nombre: publicar, exportar, emitir, responder chats, y también el segundo par de IA,
  `ai.business.*`. Donde el área no tiene ese permiso va «—». Sin módulos nada es «otro», y la columna no aparece.
- **El área.** La casilla del principio elige o quita el área entera, y queda vacía, parcial o completa. Un área de un solo
  permiso no la tiene, porque repetiría la de ese permiso.
- **Sin leyendas.** Qué permite cada permiso va en la (i) del área, un permiso por renglón, y es la descripción accesible
  de su casilla.
- **Lo que se fue.** El buscador, «Todos · Elegidos», «Expandir todo» y las áreas que se pliegan: con todo a la vista no
  hacen falta, y en la pantalla del rol nada vive en la URL.
- **En el celular.** Desde 768 px se ve la matriz; más angosto, cada área es una banda con su nombre y su (i) a la
  izquierda y la casilla del área a la derecha. Debajo van sus permisos, con el nombre entero («Ver usuarios») y 44 px para
  tocar, sin desplazar de costado.
- **Admin se lee.** Una tilde donde tiene el permiso, sin casillas, sin la columna del área y sin botones. Se va «Todos
  los permisos» de la banda, que repetía las tildes. Por qué no se cambia va en la (i) del título: «Es el rol del sistema
  con todos los permisos: no se cambia.».
- **User.** El nombre de solo lectura lleva su porqué en la (i) de «Nombre»: «Es un rol del sistema: el nombre no se
  cambia.».
- **La descripción.** El placeholder es un ejemplo, «Por ejemplo: revisa y aprueba las respuestas de su equipo.», en lugar
  de la explicación «Opcional. Una línea que explique para qué sirve.».
- **El listado.** No cambia: ya cumplía la lista de chequeo.

## Lo que se ajustó al programar

- **Las casillas, al principio de la celda.** Ver y Administrar llevan la casilla debajo del comienzo de su encabezado, y
  «Área» tiene ancho fijo (`table-fixed`). El tablero las centraba, y sin módulos «Área» se quedaba con el sobrante y las
  casillas se iban al borde derecho; ahora el sobrante va a la última columna. El tablero se corrigió igual.
- **La tabla más angosta.** Si la ventana es más angosta que la matriz (de 768 a 1024 px, con la raíz en 16 px), la tabla
  se desplaza dentro de su caja.
- **El tooltip conserva sus renglones.** `TooltipContent` pasó a `whitespace-pre-line` en `shared/ui`; ningún otro texto
  de un tooltip tenía saltos.

## En el código

- `PermissionPicker` arma la matriz o las bandas según `useMediaQuery("(min-width: 768px)")`, y el área la nombra un
  `TableRowHeader`.
- `lib/permissionPicker` aporta `areaColumns`, `hasOtherPermissions` y `areaHelp`. Se fueron la búsqueda, el resumen de
  elegidos y las áreas abiertas.
- `RoleEditorPage` pone la (i) del título de Admin y la de «Nombre» de User, saca «Todos los permisos» y dibuja el
  esqueleto con la forma de la matriz.
- Pruebas:
  - `PermissionPicker.test.tsx` cubre las dos formas.
  - `permissionPicker.test.ts` y `RoleEditorPage.test.tsx` acompañan.
  - `role-groups.spec.ts` lee Admin en las dos formas y elige otros permisos con módulos (capturas
    `role-groups-admin-1440`, `role-groups-editor-1440` y `role-groups-editor-390`).
  - `design.spec.ts` suma la escena del celular y renueva las capturas `editor-1440` y `editor-320`.
  - `business-information.spec.ts` busca el segundo par de IA en su fila.

## La lista de chequeo

Pasa las doce. La única diferencia aceptada es la del lienzo aparte: los tableros se dibujaron con los tokens y no se
armaron con la biblioteca. Roles no tiene espera de un 429 ni control de revisión, así que no hay estado de conflicto que
dibujar; un nombre repetido es el error de su campo.

## Prueba manual

1. **Listado.** «Roles y permisos» sigue igual: «Ver» en Admin, «Editar» en User y en los demás, y «Eliminar» sólo en los
   que no son del sistema.
2. **Un rol que no es del sistema.**
   - Con los módulos instalados se ven 13 filas y las cuatro columnas, sin buscador ni filtros.
   - Marcar «Ver» y «Administrar» de un área enciende Guardar.
   - Marcar un permiso de «Otros permisos» tocando su nombre lo marca.
   - La casilla del principio de «Inteligencia artificial» marca las cinco; tocada otra vez, las quita.
   - Pasar por la (i) de un área muestra un permiso por renglón.
   - Guardar vuelve al listado con «Guardamos los cambios.», y «Permisos» cuenta los nuevos.
3. **Admin.** Se lee con tildes, sin casillas ni botones; la (i) junto a «Admin» dice por qué no se cambia.
4. **User.** El nombre no se edita y su (i) dice por qué; los permisos y la descripción sí se cambian y se guardan.
5. **Nuevo rol.** Arranca vacío, con el ejemplo en la descripción; sin nombre, Guardar marca «Poné un nombre.».
6. **Con el teclado.** Tab recorre la casilla del área, Ver, Administrar y los otros permisos de cada fila, en ese orden, y
   Espacio los marca.
7. **En el celular (o la ventana a menos de 768 px).**
   - Una banda por área con la casilla del área a la derecha, y debajo los permisos con su nombre.
   - Tocar el nombre marca el permiso; nada se desplaza de costado a 320 px.
8. **En inglés,** los mismos pasos con «View», «Manage» y «Other permissions».
