# Formularios: una sola entrada — tableros elegidos

Fecha: **2026-11-23**. «Formularios» y «Diseñar formularios» listaban los mismos formularios en dos entradas del panel de
«Gestión de formularios»: una para cargar y ver respuestas, otra para el ABM. El usuario pidió unirlas: «Formularios y
adentro sería el ABM, y un ícono más que sea cargar datos». Eligió FU1-B y FU2-A el mismo día, viendo las dos opciones de
cada una.

Origen: el lienzo aparte [Formularios: una sola entrada](https://claude.ai/artifact/KWmEeeqLcLAeppZxsLZFzk) (FU, FU1 a FU4).
El Sistema visual es de otra cuenta, así que, como en carpetas y en formularios sólo en la app, este documento congela lo
elegido.

| Tablero | Qué define |
| --- | --- |
| **FU · Lo que pediste** | La captura de hoy y lo que cambia: una sola entrada, «Cargar» en cada fila, el número del panel en «Formularios» y nada nuevo para quien no diseña. |
| **FU1-B · El panel, unir y agrupar** (elegida; descartada FU1-A, sólo unir) | Se va «Diseñar formularios». Arriba, «Formularios (N)» y «Documentos recibidos (N)»; una línea de separación sin título, como entre los grupos del menú lateral; abajo, «Catálogos», «Biblioteca» y «Formularios que faltan». Cada entrada sigue con su permiso; si un grupo queda vacío, la línea no se dibuja. |
| **FU2-A · La lista única** (elegida; descartada FU2-B, la lista de Formularios con el ABM) | `/formularios` es la lista de hoy de Diseñar formularios, con sus columnas y sus filtros, más dos cosas: la columna «Por aprobar» después de «Versión activa» (sólo para quien aprueba; su número abre la planilla con lo que espera) y «Cargar» como primer ícono de cada fila publicada (el mismo + de hoy, con su nombre en el tooltip; un borrador no lo tiene). El número de «Respuestas» abre la planilla. El nombre abre el editor, también en un borrador. |
| **FU3 · Según quién entra** | Quien diseña ve FU2-A. Quien no diseña (lee, aprueba o sólo carga) ve en `/formularios` la lista de hoy de Formularios, con sus columnas por permiso, su nombre que abre la planilla y su «Cargar». Sin ningún permiso de formularios, la entrada no aparece y la dirección muestra «No tenés permiso». En el celular, la tarjeta lleva «Cargar» a todo el ancho y el resto en el ⋮. |
| **FU4 · Filtros, estados, direcciones y migas** | El desplegable de estado de Diseñar suma «Con algo por aprobar» (reemplaza la casilla de Formularios), sólo para quien aprueba. Vacíos, error y carga, los de hoy de cada lista. `/formularios/respuestas` lleva a `/formularios` conservando el filtro. El editor cuelga de «Formularios» en las migas; la planilla y la carga, como hoy. Al terminar de cargar se vuelve a la lista con su filtro y su página. |

## Para programar

- **Front:** `navigation.ts` (una entrada «Formularios» en `/formularios`, el número de lo que espera aprobación, y los
  dos grupos de FU1-B), `routes.tsx` (`/formularios` para quien diseña, carga, lee o aprueba; la redirección de
  `/formularios/respuestas`), `FormsPage.tsx` (FU2-A) y la lista de hoy de `FormOverviewPage.tsx` para quien no diseña;
  migas, textos de los dos idiomas y lo que hoy enlaza a «Diseñar formularios» o a `/formularios/respuestas`.
- **Backend:** la lista de diseño suma `pendingDecisionCount`, lo que espera la decisión de quien mira (sólo con Decide,
  como el número del panel; `lifecycle.pendingApprovalCount` cuenta todas las tareas abiertas y no sirve), y el filtro
  `Pending`, que mezcla activos y dados de baja; sin migraciones ni rutas nuevas.
- Al programar, abrir los tableros FU1 a FU3 y comparar la pantalla con ellos, no sólo con esta tabla.
- Estado: elegido y programado el 2026-11-23. Faltan las escenas de `test:visual` (el panel y las listas cambian sus capturas), la prueba a mano y pasar los tableros al lienzo del sistema visual.
