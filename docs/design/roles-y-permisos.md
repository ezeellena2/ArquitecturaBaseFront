# Roles y permisos: áreas plegables (RO3-D)

Fecha: **2026-11-19**. Estado: **elegida la RO3-D el 2026-11-19, durante la prueba integral, y programada el mismo
día**. Reemplaza a la matriz RO1-A del 2026-11-11. Faltan la prueba manual y pasar los tableros al lienzo del sistema
visual.

Los tableros están en el lienzo aparte [Roles y permisos: rediseño](https://claude.ai/artifact/MDJUPkopujPycib3mnFqcc),
filas RO3 y RO4, porque el Sistema visual no se abre desde Claude Code. Están dibujados con los tokens de la app y no
armados con la biblioteca, que tampoco se abre desde esta cuenta (la misma diferencia aceptada de los otros lienzos
aparte). Qué permiso incluye a cuál lo decide el backend: está en el
[contrato de roles](../../../ArquitecturaBase/docs/features/administracion.md).

## Por qué

- **La forma.** En la prueba integral el usuario no reconoció la matriz (Área · Ver · Administrar · Otros permisos).
- Esperaba áreas plegables con cada permiso en su fila, como el multitenant: su front, su maqueta y el tablero «Rol» de su
  lienzo.
- El 11/11 esa forma liviana no estuvo entre las opciones. «RO · Hoy» era el selector pesado: buscador, filtros, la
  descripción a media pantalla y la casilla al borde derecho.
- **Administrar sin Ver.** Con la matriz se podía guardar «Administrar usuarios» sin «Ver usuarios», y ese rol no servía:
  la ruta `/usuarios`, el menú y el listado piden «Ver usuarios». Desde RO3-D, un permiso incluye a otro.

## Los tableros

| Tablero | Qué define |
| --- | --- |
| **RO3-D · Áreas plegables** (elegida) | Una banda por área con la flecha, su casilla y su nombre; abierta, un permiso por fila con su nombre entero. «Ver catálogos de formularios», incluido, marcado y apagado con su motivo. |
| RO3-D · En el celular | La misma lista a 390 y a 320, con filas de 44 px. |
| RO3-A · La matriz con «Administrar incluye Ver» | La RO1-A con la regla nueva. Descartada. |
| RO3-B · Un nivel de acceso por área | La RO1-B con el catálogo de hoy. Descartada. |
| RO3 · Capturas reales | El selector de antes del 11/11, la matriz y el multitenant. |
| RO4 · Estados de RO3-D | Admin, rol nuevo, carga, lo incluido por más de uno, error y sin permiso, conflicto de revisión y Admin a 390, con la lista de chequeo. |
| RO2 · Estados y recorrido | Sigue valiendo para el listado, eliminar, guardar, salir con cambios y el recorrido, que no cambian. |

## La regla

- **Una lista.** Una tabla de una columna, «Permiso», igual en escritorio y en el celular.
- **Sin cuentas ni leyendas.** Sin buscador, filtros, «2 de 5» ni descripciones a la vista.
- **La banda del área.** La flecha, la casilla del área, el nombre y su (i), en el tono de sección.
- **La casilla del área.** Vacía, parcial o completa; elige o quita el área entera. La lleva toda área, también la de un
  solo permiso, para elegirla sin abrirla.
- **Abrir y cerrar.** La flecha o el nombre abren y cierran el área.
- **Al entrar.** Se abren las áreas con algo guardado o elegido, hasta que la persona abre o cierra una: ahí manda lo que
  eligió.
- **Lo quitado, a la vista.** Un área con algo guardado sigue abierta aunque se le quite todo.
- **Los permisos.** Abierta, cada permiso es una fila con su casilla y su nombre entero. Tocar el nombre lo marca.
- **Qué permite cada uno.** Va en la (i) del área, un permiso por renglón, y es la descripción accesible de su casilla.
- **Lo incluido.** «Administrar usuarios» incluye «Ver usuarios». La lista la manda el backend en el catálogo
  (`includes`); el front no la repite.
  - Marcar un permiso marca lo que incluye y lo deja apagado, con el motivo encima (`DisabledReason`, MA1-A): «Lo incluye
    «Administrar usuarios».».
  - Si lo incluyen varios, el motivo los nombra a todos: «Lo incluyen «Administrar formularios» y «Publicar formularios».».
  - El motivo sale con el mouse en la fila, el foco, un clic o un toque. Lo incluido sigue en el Tab, con `aria-disabled`.
  - Quitar el que incluye deja lo incluido marcado, y apagado mientras otro lo incluya.
  - Elegir el área suma también lo que incluyen sus permisos.
- **Lo que el rol permite.** El editor siembra, compara y guarda lo guardado más lo que incluye. Un rol viejo con
  «Administrar usuarios» y sin «Ver usuarios» abre con los dos, sin cambios sin guardar.
- **Admin se lee.** Sin casillas ni botones, y la banda sin tilde ni casilla. Sus áreas empiezan cerradas, porque están
  todas completas; cada una se abre para leer sus permisos, cada uno con su tilde. Por qué no se cambia va en la (i) del
  título: «Es el rol del sistema con todos los permisos: no se cambia.».
- **User.** El nombre de sólo lectura lleva su porqué en la (i) de «Nombre».
- **Rol nuevo.** Todas las áreas cerradas y nada marcado. La descripción lleva un ejemplo como placeholder.
- **En el celular.** La misma lista, con la banda y cada permiso de 44 px para tocar. A 320 los nombres largos pasan a dos
  renglones y nada se desplaza de costado.
- **Carga.** La tabla con «Permiso» y bandas cerradas, con el lugar de la flecha, la casilla y el nombre.
- **Error, rol borrado y sin permiso.** Como en RO2.
- **Conflicto de revisión** (`RoleReview`). No cambia de forma; compara lo que cada versión permite, con lo incluido.
- **El listado.** No cambia.

## En el código

- `PermissionPicker`: la tabla de una columna.
  - Cada área es un `tbody` nombrado por el área (`aria-labelledby`), con su banda (`TableRow tone="section"`).
  - La flecha es un `Button` con `aria-expanded`; el nombre es otra etiqueta de la flecha.
  - `AreaCheckbox`, `PermissionChoice` con `DisabledReason`, y `ReadPermission` para Admin, con una tilde.
  - Sólo guarda qué áreas abrió o cerró la persona; lo elegido lo guarda la pantalla.
- `lib/permissionPicker`: `allowedPermissions` (lo elegido más lo que incluye, en cadena), `includedBy`,
  `changePermission`, `areaStartsOpen`, `areaHelp`, `areaProgress`, `toggleArea` y `sameSelection`.
- `RoleEditorPage`: `toDraft` siembra con lo que el rol permite y espera también al catálogo. `keepDraftChanges` y el 409
  comparan lo que permite cada versión. El esqueleto tiene la forma de las bandas.
- `PermissionItem.includes` (`api/roles.ts`): lo trae `GET /api/permissions`, sin esquema de validación.
- Textos en `roles.json`: `picker.permission`, `picker.open`, `picker.close`, `picker.quoted` y `picker.includedBy`.
- Se fueron la matriz, `areaColumns`, `hasOtherPermissions`, `useMediaQuery`, los anchos fijos y `picker.columns`.
- Pruebas:
  - `PermissionPicker.test.tsx`, `permissionPicker.test.ts` y `RoleEditorPage.test.tsx`.
  - `role-groups.spec.ts`: Admin cerrado y con WhatsApp abierto, el editor con módulos y lo incluido con su motivo
    (escenario `role-included`).
  - `design.spec.ts`: la misma lista a 320 y a 1440.
  - `business-information.spec.ts`: el segundo par de IA, como filas de su área.
  - Capturas: `role-groups-admin-{1440,390}`, `role-groups-admin-open-1440`, `role-groups-editor-{1440,390}`,
    `role-included-{1440,390,320}` y `editor-{1440,320}`.

## La lista de chequeo

Pasa la de [visual-baseline](visual-baseline.md), sobre RO3-D y sus estados (RO4):

- **Entero y armado.** RO3-D, su celular y RO4. El listado, eliminar, guardar, salir con cambios y el recorrido no
  cambian (RO2). Sin diálogos nuevos.
- **Una tarea, zonas que se entienden solas.** Los datos del rol y sus permisos. «Revisar cambios» aparece sólo tras un
  conflicto, al final.
- **El control según el dato.** Los permisos, en una tabla de una columna; cada uno, una casilla; el área, una casilla
  vacía, parcial o completa.
- **Lo que se lee, en su lugar.** Admin, con tildes y sin controles apagados; un conflicto, en `ComparisonTable`.
- **Un dato por columna.** «Permiso»; en la comparación, «Dato», «Guardado actualmente» y «Mi borrador».
- **Sin leyendas.** La (i) del área y la del título de Admin. La descripción lleva un ejemplo.
- **Textos ciertos, una sola vez.** El motivo nombra a todos los que incluyen; sin cuentas; la comparación trae sólo lo
  distinto.
- **Botones y lo apagado.** Cancelar junto a Guardar, la principal última. Guardar, apagado sin cambios y sin motivo;
  tras un 409, con el suyo. Lo incluido no cambia de lugar ni de forma.
- **Lo elegido y la espera.** La casilla rellena con su tilde y la parcial con su raya. «Guardando…» con el aro. La carga,
  con la forma de las bandas.
- **Estados y mensajes.** Carga, error con reintento, rol borrado, sin permiso, conflicto y nombre repetido junto al
  campo. El resultado, en el aviso de abajo.
- **Lo mismo en toda la app.** La banda como `TableSectionToggle`, `Checkbox`, `InfoTip`, `DisabledReason`,
  `ComparisonTable` y los avisos comunes; tokens, los cinco niveles de letra y medidas en rem.
- **Celular, teclado e idiomas.** 390 y 320, con 44 px y sin desplazar de costado. Tab recorre la flecha, la casilla del
  área, la (i) y los permisos abiertos. Textos en es y en.
- **No aplican.** Diálogos nuevos, el menú ⋮, los dos vacíos, la espera de un 429, fechas y números, y el estado en la URL.
- **Diferencia aceptada.** El dibujo a mano con los tokens, como en RO2.

## Prueba manual

1. **Listado.** «Roles y permisos» sigue igual: «Ver» en Admin, «Editar» en User y en los demás, y «Eliminar» sólo en los
   que no son del sistema.
2. **Un rol que no es del sistema,** con los módulos instalados.
   - Abre con las áreas que tienen algo; las demás, cerradas.
   - La flecha o el nombre de un área la abren y la cierran.
   - Marcar «Administrar usuarios» marca «Ver usuarios» y lo deja apagado.
   - Pasar el mouse, hacer clic o llegar con Tab a «Ver usuarios» muestra «Lo incluye «Administrar usuarios».»; el clic no
     lo desmarca.
   - Con «Administrar formularios» y «Publicar formularios», el motivo de «Ver formularios» nombra a los dos.
   - Quitar uno lo deja apagado; quitar los dos lo deja marcado, y ahora se puede quitar.
   - La casilla de «Inteligencia artificial» marca sus permisos; tocada otra vez, los quita.
   - La (i) de un área muestra un permiso por renglón.
   - Guardar vuelve al listado con «Guardamos los cambios.», y «Permisos» cuenta también lo incluido.
3. **Admin.** Las áreas cerradas, sin tilde ni casilla en la banda y sin botones. Cada una se abre y muestra sus permisos
   con una tilde. La (i) junto a «Admin» dice por qué no se cambia.
4. **User.** El nombre no se edita y su (i) dice por qué; los permisos y la descripción se cambian y se guardan.
5. **Nuevo rol.** Todas las áreas cerradas y nada marcado, con el ejemplo en la descripción. Sin nombre, Guardar marca
   «Poné un nombre.».
6. **Con el teclado.** Tab recorre la flecha, la casilla del área, la (i) y los permisos abiertos. Enter o Espacio en la
   flecha abre y cierra; Espacio marca una casilla.
7. **En el celular,** a 390 y a 320.
   - La misma lista, con bandas y filas de 44 px.
   - Tocar el nombre marca el permiso; tocar lo incluido muestra su motivo.
   - Nada se desplaza de costado.
8. **Conflicto.** Con el rol abierto en dos pestañas, guardar en una y después en la otra deja «Revisar valores actuales»
   en la banda; la comparación cuenta lo incluido.
9. **En inglés,** los mismos pasos con «Permission» y «Included in “Manage users”.».

## Antes: la matriz (RO1-A), del 2026-11-11 al 2026-11-19

El 2026-09-28 el usuario rechazó el selector de antes, que ocupaba media pantalla y, dijo, «no se parece a nada de la vida
real». El 2026-11-11 se eligió y programó la matriz RO1-A, sobre RO1-B (un nivel por área) y RO1-C (la lista de áreas):
una fila por área con Ver, Administrar y «Otros permisos», como DigitalOcean, y una banda por área en el celular, sin
áreas que se plegaran. En la prueba integral del 2026-11-19 el usuario no la reconoció y eligió RO3-D. De la RO1-A quedan
la (i) del área con un permiso por renglón (`TooltipContent` con `whitespace-pre-line`), la (i) del título de Admin, la de
«Nombre» de User y el ejemplo de la descripción.
