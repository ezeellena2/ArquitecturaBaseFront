# Charts: piezas de gráfico

Las piezas de un tablero (DOC7-A, [diseño](../../../../docs/design/documentos.md)), sin librería y con los colores de gráfico de
`index.css` (`--chart-1..5`, `--chart-quiet` y `--chart-track`). No conocen contratos ni features: el dueño escribe cada número y
cada fecha (`shared/lib/dateTime`, `typedValue`) y nombra cada pieza.

- `StatCard`: el número con su nombre en gris, al nivel de un título de pantalla, y su detalle en gris (la variación contra el
  período anterior con su signo, o por qué dice «—»); `loading` ocupa su lugar. Con `flush` es una celda de un marco que dibuja el
  borde y las líneas entre sus números (el resumen de Consumo, CO1-B), sin borde ni esquinas propios.
- `BarChart`: barras por período desde una sola línea de base, una serie y sin leyenda (la nombra el título de su tarjeta). Un
  balde en cero es una barrita en el tono suave; uno negativo, sin barra y con su cifra sobre la línea de base; uno sin valor
  (null), sin barra y «—». La cifra va sobre la barra sólo si entra en su lugar (cada balde es un contenedor) y el eje nombra
  pocas fechas, enteras y con números, más a medida que la tarjeta crece: la primera y la última, debajo de su barra mientras
  entran en su lugar y contra el borde cuando no. Cada balde dice su período y su valor al pasar el mouse y al lector de pantalla.
- `BarList`: el reparto de una pregunta, un renglón por opción con su nombre, su barra contra la más larga y «38 · 31%», con una
  línea entre renglones; donde no entra, la barra baja debajo del nombre. `tone` es el color de la barra (lo que queda, en gris; un
  estado, el de su rol): el color nunca dice algo solo.
- Las dos tienen su gemela en tabla (`asTable`, «Ver como tabla»): un dato por columna, los números a la derecha, con `DataTable`.
- `ChartRefreshing`: gráficos que vuelven a leer quedan a la vista, atenuados y fuera de alcance, con la línea que corre (LC2-A).

## Al modificar

- Barras finas (24 px como mucho, extremo redondeado y base recta, 2 px entre una y otra), sin grilla ni leyenda para una sola
  serie, el texto en las tintas del texto y nunca del color de la serie, y todo valor también en la tabla. Un color nuevo es un token.
- Con muchos baldes el espacio entre barras se achica (`columnGap`, un cuarto del ancho como mucho): los 400 que manda el servidor
  entran en un teléfono, la última barra adentro y la última fecha debajo de ella.
- Los valores son números de JSON (el contrato del backend): más allá de unos 15 dígitos significativos el navegador pierde los
  últimos, y la pieza muestra lo que le llegó, ya escrito por su dueño.
- No agregar librerías de gráficos: lo que falta se suma acá, con su ficha en el catálogo (`?scenario=charts`).
- Geometría, cifras que entran y lectura al pasar el mouse se prueban en el navegador (`src/test/visual/charts.spec.ts`).

## Referencias

- [Biblioteca compartida](../AGENTS.md) y [estándar visual](../../../../docs/guides/estandar-visual.md).
- [Tablero de un formulario](../../../features/business-forms/components/AGENTS.md).
