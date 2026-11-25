# Tarjetas del chat: los datos de las propuestas y de las fuentes, ordenados (TC1 a TC4)

Fecha: **2026-11-24**. Estado: **propuesto, esperando que el usuario elija**. Sin programar. Sólo cambia el front: ni
contratos ni servidor.

## Por qué

En la prueba integral del 24/11, probando el asistente de Inicio con audio y planillas, el usuario mandó dos capturas
(el catálogo «Tipos de tarea» y la importación en «Contratistas») y escribió:

> ¿Habrá alguna manera de mejorar los diseños de presentación de los datos del chat? Es como que está bien la tabla, le
> falta un poco de borde y diseño de contorno, pero después los datos arriba no me convencen así sin formato o medio
> como puesto así nomás.

Lo que hay hoy (`FormsProposalCard.tsx` sobre `AssistantProposalCard` y `AssistantSources.tsx`):

- Arriba de la tabla todo es texto suelto: el resumen junta tres datos en un renglón gris («Texto · 2 campos · 86
  filas»), la descripción va como párrafo y cada columna es un renglón «Código · CUIT · columna A», contra
  [Lecturas](../design/visual-baseline.md#lecturas) y [un dato por columna](../design/visual-baseline.md#un-dato-por-columna--2026-11-09).
- La muestra no tiene contorno propio y «y 83 filas más» queda suelto debajo.
- En el formulario, el tipo y si es obligatoria van debajo de cada pregunta, contra
  [nada debajo de otro dato](../design/visual-baseline.md#nada-debajo-de-otro-dato--2026-11-22).
- En las fuentes, «Consultado …» va debajo del nombre y cada fila de datos es una lista aparte.

Se buscó un plan que ya lo cubriera: la IA que arma formularios y catálogos
([etapa 2](../../../ArquitecturaBase/docs/plans/2026-11-09-ia-arma-formularios-etapa-2.md)) creó estas tarjetas, pero está
por cerrarse y esto es un cambio visual del front que también toca las fuentes del núcleo; va aparte, como los otros
planes visuales del front.

## Tableros

Lienzo aparte [Tarjetas del chat](https://claude.ai/artifact/4GsKuYkAbyZwQyam3yiU5S), dibujado con el CSS compilado y el
marcado reales del front (la escala de escritorio al 75 % en los tableros de compu, 16 px en los de 390):

- [TC · Hoy](https://claude.ai/artifact/4GsKuYkAbyZwQyam3yiU5S#artboard-Main): las dos capturas del usuario y las de
  referencia de la suite visual (`assistant-proposal-sheet`, `-import`, `assistant-proposal` y `assistant-answer`), a
  1440 y 390 px, en español y en inglés.
- [TC1](https://claude.ai/artifact/4GsKuYkAbyZwQyam3yiU5S#artboard-TC1) y
  [TC1 · 390](https://claude.ai/artifact/4GsKuYkAbyZwQyam3yiU5S#artboard-TC1-390): los datos de arriba de la tabla, con
  «Hoy» al lado (catálogo con planilla, catálogo de una sola columna e importación).
- [TC2](https://claude.ai/artifact/4GsKuYkAbyZwQyam3yiU5S#artboard-TC2) y
  [TC2 · 390](https://claude.ai/artifact/4GsKuYkAbyZwQyam3yiU5S#artboard-TC2-390): el contorno de la muestra.
- [TC3](https://claude.ai/artifact/4GsKuYkAbyZwQyam3yiU5S#artboard-TC3) y
  [TC3 · 390](https://claude.ai/artifact/4GsKuYkAbyZwQyam3yiU5S#artboard-TC3-390): las preguntas del formulario.
- [TC4](https://claude.ai/artifact/4GsKuYkAbyZwQyam3yiU5S#artboard-TC4) y
  [TC4 · 390](https://claude.ai/artifact/4GsKuYkAbyZwQyam3yiU5S#artboard-TC4-390): las fuentes de una respuesta.
- [Inglés](https://claude.ai/artifact/4GsKuYkAbyZwQyam3yiU5S#artboard-EN) y
  [Inglés · 390](https://claude.ai/artifact/4GsKuYkAbyZwQyam3yiU5S#artboard-EN-390): las recomendadas en inglés.

TC1-B con TC2-B y TC3-A se miraron también adentro de la app, en el catálogo visual (`?scenario=assistant-proposal-sheet`
y `assistant-proposal`), con el marcado inyectado: en la compu la tabla de preguntas entra sin desplazarse y a 390 px la
muestra se desplaza adentro de la tarjeta, sin mover la página.

## Lo que decide el usuario

| Decisión | Opciones | Recomendada |
| --- | --- | --- |
| TC1 · Los datos de arriba | **A**: la ficha en dos columnas (`DataList`: Descripción, Tipo de valor) y una tabla «Columnas» (Dato del catálogo · Columna de la planilla · Tipo); la muestra conserva los encabezados de la planilla. **B**: la misma ficha y la muestra nombra cada columna: arriba el dato del catálogo, debajo, en gris, «A · CUIT»; se va la lista de columnas. | **B**. Diferencia aceptada: el tipo de cada campo no se nombra; se ve en la muestra (los números van a la derecha). |
| TC2 · El contorno de la muestra | **A**: en su propio recuadro, adentro del margen. **B**: de borde a borde de la tarjeta, con un pie del tono de la banda, «Primeras 3 de 86 filas». **C**: B más la tarjeta entera como zona (`Surface`: banda verde, el tipo en versalitas, el borde de las zonas). | **B** |
| TC3 · Las preguntas del formulario | **A**: una tabla (N.º · Pregunta · Tipo · Opciones · Obligatoria · Cambio); «Opciones» sólo si alguna pregunta las tiene y «Cambio» sólo cuando la propuesta ajusta otra. **B**: un renglón por pregunta con las mismas columnas, sin encabezado. | **A** |
| TC4 · Las fuentes | **A**: cada fuente en la tarjeta de las propuestas: «Fuente verificada» y «Abrir fuente» en la banda, el nombre de la fuente, los datos en `DataList` (una fila) o en una tabla (varias) y «Consultado …» en el pie. **B**: sin tarjeta, debajo de una línea como hoy, con «Abrir fuente» junto al nombre y «Consultado» como un dato. | **A** |

## Qué tiene que quedar (cuando elija)

Igual a los tableros elegidos, en la compu y a 390 px, con los textos en inglés del tablero
[Inglés](https://claude.ai/artifact/4GsKuYkAbyZwQyam3yiU5S#artboard-EN). Al programar se abre cada tablero y se compara
elemento por elemento
([revisión del cambio](../../../ArquitecturaBase/docs/guides/validar-un-cambio.md#antes-de-cerrar-lo-que-más-se-repite-en-las-revisiones)).

Con las recomendadas, cada tarjeta queda así, de arriba abajo:

- **Catálogo con planilla**: banda «Catálogo» con «Crear catálogo»; el nombre en negrita; `DataList` con Descripción y
  Tipo de valor; la muestra de borde a borde: el encabezado con el dato del catálogo (Código, Opción, cada campo) y, en un
  segundo renglón gris, la columna de la planilla («A · CUIT», o «Columna A» si la planilla no tiene encabezados); tres
  filas; el pie «Primeras 3 de 86 filas». El código y la opción que salen de la misma columna van en una sola: «Código y
  opción».
- **Catálogo sin planilla**: la ficha suma un renglón por dato (Código, Opción y cada campo con su tipo); no hay muestra.
- **Importación**: banda «Importación» con «Revisar la importación»; el nombre del catálogo; la muestra igual a la del
  catálogo con su pie. Se va «Texto · 86 filas».
- **Formulario**: banda con «Ver cómo queda» y «Crear borrador»; el nombre; `DataList` con Prefijo (y «Lee documentos»
  cuando la propuesta prende la lectura); la tabla de preguntas de borde a borde, sin pie.
- **Fuente**: banda «Fuente verificada» con «Abrir fuente» (si hay destino y permiso); el nombre de la fuente; una fila,
  en `DataList`; varias filas con los mismos datos, en una tabla con los números a la derecha; el pie «Consultado
  04/10/2026 9:00». Un resultado parcial lleva la etiqueta «Resultado parcial» en la banda.

No cambian: la tarjeta plegada (reemplazada o creada), los botones y sus permisos, el aviso de un problema al crear, el
recorrido de crear o revisar la importación, el rayado de las filas y las tarjetas del chat de WhatsApp.

## Tareas (después de la elección)

1. **La pieza común** (`shared/ui/assistant/AssistantProposalCard.tsx`, `index.css`). Primero el test.
   - Se va `summary`: lo que decía pasa a la ficha.
   - La tabla de borde a borde y su pie como pieza de la tarjeta (`.assistant-proposal-table`,
     `.assistant-proposal-table-foot`), con el renglón gris del encabezado (`.assistant-proposal-source`) y el pie de una
     tarjeta sin tabla (`.assistant-proposal-foot`). Las clases, en `index.css`, junto a las de la tarjeta.
2. **Formularios** (`FormsProposalCard.tsx`). TDD en lo que decide: qué columnas lleva la muestra (una por letra, con
   el dato del catálogo y la columna de la planilla), el texto del pie (plural, y «Las 2 filas» cuando entran todas),
   cuándo aparecen «Opciones» y «Cambio», y la ficha de un catálogo sin planilla.
   - `CatalogCard` e `ImportCard`: la ficha y la muestra nueva; `MappingLine` se va.
   - `FormCard`: la ficha y la tabla de preguntas; `QuestionLine` se va.
   - La propuesta de personas conserva sus avisos, debajo de la ficha.
3. **Las fuentes** (`features/artificial-intelligence/components/assistant/AssistantSources.tsx`). TDD en la regla de
   una fila contra varias (varias filas con los mismos datos van en tabla) y en el destino que no se puede abrir.
4. **Textos** en `forms.json` y `assistant.json`, en español e inglés: el pie («Primeras {{shown}} de {{count}} filas»),
   los encabezados de la tabla de preguntas, «Código y opción», «Fuente verificada». Las claves que dejan de usarse se
   cruzan con `src` por un script antes de borrarlas (las armadas con `"prefijo." +` y los `t(cond ? … : …)`).
5. **Escenas visuales**: rehacer y mirar una por una `assistant-proposal`, `assistant-proposal-sheet`,
   `assistant-proposal-import`, `assistant-proposal-preview` y `assistant-answer`, y sumar una fuente de varias filas y
   un catálogo de una sola columna, en español y en inglés, a 1440, 390 y 320 px. Como se toca una pieza de
   `shared/ui`, también corre `design.spec.ts`.
6. **La regla general**: una sección «Tarjetas con datos del chat» en `visual-baseline.md` (los datos de la tarjeta en
   `DataList`, una colección en una tabla de borde a borde con su pie, la columna de origen en el encabezado, las fuentes
   en la misma tarjeta) y el punto de la lista de chequeo que corresponda; `shared/ui/assistant/AGENTS.md`,
   `features/business-forms/components/AGENTS.md` y `docs/design/ia-arma-formularios.md` (IA1-A).
7. **Cierre**: build, lint, los tests del área y las escenas por el carril; la corrida completa va con la del cierre de
   la prueba integral. Después, la prueba a mano en el chat de Inicio y el retiro del plan con la auditoría documental.
