# Lib: utilidades puras del front

Contiene formato de fechas por zona y de valores tipados, nombres de países y `cn`. Son mecanismos reutilizables sin lógica de una feature.

## Al modificar

- `formatDateInZone` sirve para fechas, `formatDateTimeInZone` para detalles y `formatTimeInZone` para horas de mensajes. `calendarDateInZone` da identidad de día local para agrupaciones, independiente del idioma. No agregar formateadores locales ni mostrar UTC crudo.
- `formatDateOnly` valida fecha sin hora; el estilo `numeric` permite dd/MM/yyyy o MM/dd/yyyy sin depender de zona ni alterar el formato predeterminado.
- `typedValue` es el único formato de valores tipados (entero, decimal, fecha sin hora, sí/no) en tablas, importación, resúmenes, respuestas y el chat: `formatTypedValue` agrupa los números exactos (es-AR o en-US) y muestra la fecha numérica, y devuelve null si el valor no es canónico; `formatYesNo` nombra sólo true y false. Las fechas con hora siguen con `formatDateInZone`/`formatDateTimeInZone`.
- `cn` se reexporta desde `utils`; no agregar otra librería para combinar clases.
- El front envía país y número al backend: no implementar normalización telefónica acá.
- Una utilidad nueva necesita un consumidor compartido y pruebas de su comportamiento cuando tenga lógica.

## Referencias

- [Fechas y utilidades](../../../docs/architecture.md).
- [Formato común de fechas](dateTime.ts).
- [Formato común de valores tipados](typedValue.ts).
- [Combinación de clases](utils.ts).

- `appearance` define la paleta inicial Campo, valida colores y deriva contraste de texto, foco y hover.
  No cambia success/warning/danger. Los valores explícitos iniciales permiten que la vista previa
  del borrador quede independiente de la paleta guardada.
