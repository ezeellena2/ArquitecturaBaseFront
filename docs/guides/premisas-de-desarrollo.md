# Premisas de desarrollo del front

Estado: **vigente**. Aprobadas por el usuario el **2026-09-30**.

Estas reglas valen para todas las pantallas actuales y futuras, y para cada proyecto que salga de
esta plantilla. Una feature aporta sus datos, permisos y reglas de negocio; los componentes de
`shared/ui`, los hooks comunes y los layouts definen cómo se presenta y se usa la interfaz.
El [fundamento visual](../design/visual-baseline.md) define el diseño aprobado; [architecture.md](../architecture.md) define
la arquitectura y las convenciones. Los contratos del backend y la accesibilidad prevalecen.

## Una sola base visual

- La paleta es **Jade equilibrado**, en los tokens de `src/index.css`: menú profundo, barra superior
  suave, cabecera de pantalla clara, cabecera de tabla más marcada, filtros y campos con sus tonos.
  Public Sans, tamaños, radios, bordes y foco se resuelven desde el sistema común.
- Usar `AppLayout` o `AuthLayout` y `Page`. Los layouts gestionan navegación, migas, menú móvil y
  desplazamiento; `Page` aporta el título, las acciones y el margen del contenido. Una feature no
  vuelve a dibujar esas piezas.
- Los íconos de navegación salen de `layouts/navigation.ts`, con el set común. Administración y
  sus destinos muestran íconos decorativos de 16 px junto al texto, también en móvil. Los botones
  del borde del menú tienen fondo blanco y flecha verde, en ambos estados.
- El contenido principal y los diálogos conservan superficie blanca; selección, foco, peligro,
  atención y éxito tienen roles propios. Un estado también se explica con texto o un nombre accesible.
- Todo tono nuevo se define como token. Una variante reutilizable se agrega al componente común;
  no se agregan valores hex, alturas alternativas ni selectores por URL en una pantalla.
- Lo que usan dos features sube a `shared`. No importar componentes de una feature desde otra.
  Las opciones y consultas de un filtro son de la feature; la presentación reutilizable es del sistema.

## Estructura de una pantalla

Criterio pedido por el usuario el 2026-09-30: pantallas breves, ordenadas por tarea y con una
cabecera clara. No acumular opciones y explicaciones de temas independientes en un formulario largo.

- Una pantalla resuelve una tarea. Los temas independientes tienen destinos propios dentro del
  menú de su área; el menú expresa la estructura, sin agregar otra navegación dentro del contenido.
  En Configuración: Idioma, Zona horaria, Listados y Registro, cada uno con su cabecera y guardado.
- La cabecera de Page tiene el nombre del tema, el estado necesario y la acción principal.
  Las migas muestran el contexto. No repetir el título en una tarjeta ni llenar la cabecera de ayudas.
- La información se ordena como etiqueta → valor/control → ayuda breve cuando hace falta.
  No agregar datos técnicos, auditoría, instrucciones largas ni resúmenes que no ayudan a decidir.
- Elegir el componente según el dato: una colección administrable usa tabla; un valor de un catálogo
  usa selector; pocas alternativas que requieren explicación usan radios; varias selecciones usan
  checks o MultiSelect; un dato libre usa un campo. No usar una tabla para presentar un único ajuste.
- Un formulario puede tener varios campos cuando resuelven la misma tarea. La relación entre ellos,
  no la cantidad de controles, decide si van juntos. Los temas independientes no se agrupan para
  llenar espacio y las superficies no se agregan como decoración.
- El tablero previo debe definir menú/ruta, cabecera, datos, controles, acción, estados y mensajes.
  El diseño y el plan se revisan antes del desarrollo. Si eso no está resuelto, la maqueta sigue
  siendo propuesta; no se completa su estructura improvisando durante la implementación.

## Filtros y búsqueda

- Envolver los controles en `FilterBar`, separado de la tabla. Compone buscador, filtros principales,
  filtros secundarios y el resumen de resultados; deja que los controles pasen a otra línea en móvil.
- Usar `SearchInput` para búsqueda con espera. Pocas opciones excluyentes y frecuentes se muestran
  con `SegmentedControl`; un catálogo se presenta con `Select` o los menús compartidos. Los filtros
  menos usados van en “Más filtros”; lo aplicado se muestra y se puede quitar individualmente.
- En listados, usar `usePagination`, `useFilters` y `useQueryUpdate`. Búsqueda, página, tamaño, orden
  y filtros viajan en la URL con los nombres del backend; no duplicarlos en estado de la pantalla.
  El borrador interno de `SearchInput` solo permite escribir antes de confirmar la búsqueda.
- Cambiar búsqueda o filtros vuelve a la primera página. Actualizar filtro y página juntos; omitir
  valores por defecto y conservar el orden al limpiar. Atrás y una URL compartida restauran la vista.
- Los conteos por opción salen del backend con los demás filtros aplicados e ignorando el propio.
  No contarlos sobre la página visible. Una opción con cero coincidencias queda deshabilitada.
- Mostrar cuántos resultados hay y una acción para limpiar cuando hay filtros activos. Distinguir
  “todavía no hay datos” de “ninguno coincide”: el primero ofrece crear cuando hay permiso; el segundo,
  limpiar los filtros. Conservar las piezas existentes de `UsersFilterBar` como referencia y promover
  sus controles genéricos a `shared/ui` cuando otra feature los necesite.

## Tablas

- Usar `DataTable` y `Pagination` para listados. Cuando una tabla tiene secciones u otra estructura,
  componer los primitivos de `shared/ui/table`; usar siempre `TableHeader` y `TableHead` para conservar
  cabecera, tono, borde y tipografía comunes. No duplicar las clases de la cabecera en cada tabla.
- Cada dato tiene su columna y su encabezado. No mezclar datos distintos como insignias junto al
  nombre. Una excepción requiere una revisión explícita; no se copia la excepción del punto de estado
  de usuarios a otros listados por defecto.
- Declarar `rowKey` con la identidad estable de la fila. Las columnas ordenables usan los campos
  aceptados por el backend; conservar `aria-sort` y ordenar/paginar con el servidor.
- La tabla contiene su scroll horizontal en móvil; no desborda el documento. Las medidas de los
  componentes comunes son la referencia: no cambiar la densidad de filas en una feature.
- Pasar los estados de carga, error, reintento y vacío al componente. No dejar una tabla en blanco
  mientras se carga ni presentar un fallo como si fuera un listado vacío.
- Las acciones de una fila usan `RowActions`: un grupo, acciones inocuas primero y destructiva al
  final. Cada una tiene nombre accesible con el dato de la fila y tooltip. Sin permiso, se oculta.
- Las fechas usan `formatDateInZone` o `formatDateTimeInZone`, según necesiten hora, con el idioma
  y la zona de la cuenta. No crear formateadores locales por pantalla.

## Formularios y selección

- Cada campo usa `FormField` con una etiqueta visible, su control y la ayuda o el error asociado.
  El placeholder muestra un ejemplo; no reemplaza la etiqueta. Usar `Input`, `Textarea`, `Select`,
  `MultiSelect` y `NativeSelect`; estos últimos sirven para listas extensas y selección nativa.
  Teléfonos y códigos usan `PhoneField` y `OtpInput` cuando corresponda.
- Los campos heredan fondo, borde, foco y validación. Conservar `aria-invalid`, `aria-describedby`,
  límites del contrato y autocompletado pertinente. No cambiar los controles solo para esconder
  una validación o un estado deshabilitado.
- Una casilla con texto usa `CheckboxField`; una celda de tabla usa `Checkbox` con nombre accesible.
  La etiqueta permite marcar la casilla. La ayuda explica la consecuencia; el error explica qué corregir.
- Un grupo de checks admite ninguno, algunos (`indeterminate`) y todos. El alcance de “todos” debe
  ser explícito: sección, resultados filtrados o página. No cambiar otras secciones ni seleccionar
  datos que la persona no puede administrar.
- Usar `RadioGroupField` para una única opción entre pocas, `MultiSelect` para varias y `Switch`
  para un ajuste que se aplica de inmediato. Un switch que guarda al cambiar muestra la petición
  pendiente y recupera el valor anterior si falla, como Configuración.
- Un control deshabilitado mantiene el valor legible y, cuando no es evidente, la razón visible.
  Los estados de validación no dependen solo del color.
- Una mutación conserva el borrador ante un fallo. Mostrar que está guardando y evitar envíos
  duplicados; anunciar éxito solo después de la respuesta. Invalidar las consultas afectadas,
  incluidos los conteos, el detalle y los permisos del usuario actual cuando corresponda.

## Botones y acciones

- Usar `Button`: acción principal `default`, secundaria `outline`, terciaria `ghost` o `link`,
  y `destructive` para confirmar una consecuencia destructiva. Los tamaños son los de la biblioteca.
- El texto nombra la acción: “Guardar”, “Crear usuario”, “Eliminar rol”. Dentro de un formulario,
  solo su envío usa `type="submit"`; el resto usa `type="button"`.
- Una acción que navega es un enlace (`Button asChild` cuando necesite aspecto de botón).
  Una acción que modifica o abre un diálogo es un botón.
- Un botón solo con ícono usa `IconButton` con nombre accesible. Los tooltips usan `ActionTooltip`
  y funcionan con foco de teclado y portales; no usar el atributo `title` como única explicación.
- Los permisos se piden en la ruta y se reflejan en las acciones y el menú. La seguridad la decide
  el backend; la interfaz no inventa permisos ni usa roles como sustituto de ellos.

## Modales y formularios con ruta propia

- Un formulario corto sobre un listado usa `Dialog`; uno largo o con muchas secciones usa su
  propia ruta. No meter un editor extenso en un modal ni crear un modal con posición y overlay propios.
- Componer `DialogContent`, `DialogHeader`, `DialogTitle`, `DialogDescription` cuando aporte contexto
  y `DialogFooter`. El pie tiene Cancelar y la acción concreta. Conservar navegación por teclado,
  cierre y tamaño adaptable; el contenido extenso debe poder desplazarse sin ocultar sus acciones.
- Montar el formulario solo mientras esté abierto, para inicializarlo con sus datos. Restaurar el
  foco con `useRestoreFocusOnClose` cuando lo abra un botón ajeno a `DialogTrigger`.
- Usar `ConfirmDialog` para eliminar, cambiar acceso o descartar cambios. Decir qué se afecta y
  nombrar la confirmación; no usar “Aceptar” sin explicar la acción.
- En un formulario con ruta propia, usar `Page.backTo`, `useBreadcrumbLeaf` y
  `useUnsavedChangesGuard`. La confirmación de salida permite seguir editando o descartar;
  se desactiva la guarda durante el guardado y se vuelve al listado después del éxito.

## Mensajes de error y notificaciones

El [contrato único de mensajes y estados](mensajes-y-estados.md) es obligatorio en todas las
pantallas públicas y privadas, incluidos formularios y diálogos. Define canales, duración,
cierre, acciones, dueño del aviso, fallbacks, accesibilidad y pruebas. No se redefine por feature.

- Resultados operativos, errores generales, warning e info: único Toaster abajo a la derecha.
- Validación de un dato: junto al campo/grupo, con asociación accesible; no repetirla en un toast.
- Decisión previa: ConfirmDialog. Condición duradera: dato, ayuda o estado del flujo.
- Carga inicial fallida: estado con Reintentar y causa en un único aviso. Refetch con datos previos:
  conservar el contenido y el borrador; no convertirlo en un vacío o borrar el editor.
- Un hecho tiene un dueño y no se anuncia dos veces. Una escritura incierta se revisa antes de repetirla.

Este contrato sustituye los errores generales encima de los botones y los Banner de operaciones.
El código existente tiene desvíos: el [plan de unificación](../plans/2026-09-30-unificacion-mensajes.md)
los releva por superficie y define el mecanismo y las pruebas que faltan. No se declara
uniformidad por haber escrito la regla ni por aprobar un test que solo comprueba el texto.

## Cómo se agrega una pantalla

1. Definir tarea, menú/ruta, cabecera, datos, controles, canal, dueño y recuperación de cada mensaje. Revisar el contrato
   funcional, permisos y esta guía; dibujar el tablero completo y obtener la elección
   del usuario según el fundamento visual antes de programar una pantalla nueva.
2. Componer los layouts y componentes existentes. Si falta una pieza reutilizable, agregarla a `shared`
   y documentar su contrato; conservar un único lugar donde se definen su aspecto y su comportamiento.
3. Cubrir carga, datos, vacíos, error/reintento, validaciones, éxito y falta de permiso según el caso.
   Probar teclado, retorno del foco, menú y tablas desde 320 px, y ambos idiomas.
4. Verificar lógica y recorridos con tests significativos, usando TDD donde haya lógica. Para mensajes,
   comprobar canal, cantidad, conservación del borrador y recuperación según el contrato común. No escribir
   pruebas que solo repitan clases CSS. Correr `npm run build`, `npm run lint` y `npm run test`.
5. Actualizar el fundamento visual cuando cambie una decisión común. Las propuestas se retiran al
   elegir; la sincronización pendiente de la biblioteca externa se registra sin presentar el Artifact
   como si ya hubiera sido actualizado.
