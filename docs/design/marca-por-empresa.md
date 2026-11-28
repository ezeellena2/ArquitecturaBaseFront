# Marca por empresa: los tableros elegidos (ME1-A y ME3-B)

Fecha: **2026-11-27**. Cada empresa que contrata el producto tiene su instalación, y su administrador le pone la marca en
Configuración › Apariencia: logo, ícono, nombre, colores y letra. No hay código ni ramas por empresa. El titular eligió
**ME1-A** (el logo arriba del menú) y **ME3-B** (un quinto color, «Acento del menú»). El alcance y las decisiones ME2 a
ME8 están en la sección «Marca por empresa» del plan
[producción por cliente](../../../ArquitecturaBase/docs/plans/2026-11-27-produccion-por-cliente.md#marca-por-empresa-me);
este documento congela las pantallas de sus tareas T11 y T12.

Origen: el lienzo aparte [Marca por empresa](https://claude.ai/artifact/YKWuNW5xwL4EfSgstiMWrn), dibujado con la marca de
La Clementina (su logo, azul pizarra `#2B4150`/`#223340`, crema `#F6F2E9`, acento `#FFC10E`, Hanken Grotesk). El lienzo
es privado y puede cambiar fuera de Git: lo que vale es esto.

| Tablero | Qué define |
| --- | --- |
| **ME1-A · El logo arriba del menú** (elegida) | La banda de arriba del menú principal (la de 36 px que hoy está vacía) lleva el logo a 22 px de alto, alineado a la izquierda con el padding del menú, como enlace al inicio («<nombre>, ir al inicio»). El ítem activo del menú principal, con la barra y el texto en el acento |
| **ME2 · Apariencia con la marca** | La pantalla de Apariencia con tres zonas: «Marca», «Colores y letra» y «Vista previa» |
| **ME3 · columna B** (elegida) | El acento del menú en la barra y el texto del ítem activo |
| **Dónde más aparece** | El ingreso en la compu y en el teléfono, la pestaña, el menú contraído, el PDF y la instalación sin logo |
| **Estados y recorrido** | Sin logo, subiendo, archivo que no sirve, quitar con confirmación, conflicto, y lo que no cambia |

Se descartaron ME1-B (el logo en la barra superior) y ME3-A (sólo cuatro colores).

## Apariencia (`/configuracion/apariencia`)

La banda conserva «Descartar» y «Guardar cambios» (y «Revisar» cuando hace falta), que guardan los nombres, los colores y
la letra en un solo pedido, como hoy. Debajo:

- **Marca** (con la (i) del título: dónde aparecen el logo y el ícono). Una grilla de dos columnas, de hasta 760 px:
  - **Logo** (con su (i): PNG o JPG de hasta 1 MB, apaisado; se guarda al subirlo). La muestra es un rectángulo de
    150 × 36 px con el color del menú y el logo a 22 px, o el nombre de la aplicación en texto si no hay logo. A la
    derecha, «Subir logo» o «Subir otro» (abre el selector de archivos) y, si hay logo, el ícono rojo «Quitar el logo».
  - **Ícono** (con su (i): PNG cuadrado, desde 64 px; se guarda al subirlo). Muestra de 36 × 36 px con el color del
    menú y el ícono a 22 px; «Subir ícono» o «Subir otro» y «Quitar el ícono».
  - **Nombre de la aplicación** y **Nombre del remitente**, obligatorios, como hoy.
  - **Así llega**, a todo el ancho: el remitente, el asunto de un código y el encabezado del correo con el logo subido
    (o el nombre, si no hay logo). El campo «Logo de los correos» desaparece.
- **Colores y letra**, con «Restaurar los iniciales» en el título. Los cuatro colores de hoy, **Acento del menú** (con su
  (i): marca el ítem activo del menú y tiene que leerse sobre el color del menú) y **Letra**, un desplegable simple con
  Public Sans (la inicial), Inter, IBM Plex Sans, Source Sans 3, Hanken Grotesk y Nunito Sans.
- **Vista previa**: la de hoy, con el logo en la banda del menú, el acento en el ítem activo y la letra elegida.

### Estados

- **Sin logo:** la muestra dice el nombre de la aplicación sobre el color del menú y el botón dice «Subir logo».
- **Subiendo:** la muestra con un bloque de carga y el botón apagado «Subiendo…». Al terminar, el aviso «Logo guardado»
  y el logo ya se ve en el menú. Lo que esté sin guardar en el resto de la pantalla queda como estaba, y la pantalla
  adopta la revisión nueva que devuelve el servidor.
- **Archivo que no sirve:** el error debajo del campo, en rojo («“logo.svg” no sirve: tiene que ser PNG o JPG de hasta
  1 MB.»), sin cambiar el logo anterior. El navegador lo revisa antes de mandar y el servidor revisa lo mismo.
- **Quitar:** el diálogo «¿Quitar el logo?» («En el menú, el ingreso, los correos y los PDF vuelve a verse el nombre de
  la aplicación.»), con «Cancelar» y «Quitar logo» en rojo. Para el ícono: «¿Quitar el ícono?», y la pestaña vuelve al
  ícono de siempre.
- **Conflicto o resultado incierto** al subir o quitar: el mismo aviso y «Revisar» de Guardar. La comparación suma
  «Acento del menú» y «Letra»; el logo y el ícono no entran porque no son borrador.
- **Carga, error con «Reintentar» y sin permiso:** los de hoy. El permiso sigue siendo administrar la Configuración.

## Dónde más aparece

- **Menú principal:** el logo en la banda de arriba (ME1-A); contraído, el ícono a 22 px centrado, o la banda vacía si
  no hay ícono. Sin logo, la banda dice el nombre de la aplicación en texto, con peso 600.
- **Ingreso, solicitud y página pública:** el logo reemplaza a la letra y «Tu organización» en la banda de arriba, a
  22 px, como enlace al inicio; sin logo, el nombre de la aplicación.
- **Pestaña:** el título es «pantalla · nombre de la aplicación» y el ícono, el que se subió; sin ícono, el de siempre.
- **Correos y PDF:** el logo donde hoy va el nombre (los arma el servidor).
- **Letra:** toda la app, con la escala y los pesos de hoy. Se carga sólo la elegida.
- **Paleta inicial:** sin colores propios, la app conserva el CSS aprobado: el texto del ítem activo sigue blanco y el acento
  `#D3D7D5` pinta la barra, el foco y el avatar, como antes.

## Contraer el menú (MC3-D, 2026-11-28)

Elegida por el titular en el tablero «MC3-D · Las flechas al lado de Inicio». Tres chevrones en el renglón de Inicio,
contra el borde derecho del menú («Contraer el menú»); contraído, debajo del ícono de Inicio («Expandir el menú»). Se ven
con o sin panel abierto y reemplazan a la flecha redonda del borde del menú; la del panel sigue cerrando sólo el panel. En
el teléfono no cambia nada.
