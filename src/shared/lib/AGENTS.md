# Lib: utilidades puras del front

Contiene formato de fechas por zona y de valores tipados, nombres de países y `cn`. Son mecanismos reutilizables sin lógica de una feature.

## Al modificar

- **Una fecha se muestra siempre con números: `dd/MM/yyyy` en español (`03/11/2026`) y `MM/dd/yyyy` en inglés.** Nunca el mes en letras («3 nov 2026», «Nov 3, 2026»), nunca `dateStyle` ni un formato propio de una pantalla (2026-11-10). Las tres funciones comparten `dayOptions`; con hora, el resto es `HH:mm` (`03/11/2026, 21:00`).
- `formatDateInZone` sirve para fechas, `formatDateTimeInZone` para detalles y `formatTimeInZone` para horas de mensajes. `calendarDateInZone` da identidad de día local para agrupaciones, independiente del idioma. No agregar formateadores locales ni mostrar UTC crudo.
- `dateTime` y `decimal` guardan un `Intl.*Format` por idioma, zona y opciones (2026-11-07): crearlo cuesta unas cien veces más que usarlo, y un historial o una tabla formatea en cada render. Una función de formato nueva reusa esos mapas en lugar de construir uno por llamada.
- `formatDateOnly` valida una fecha sin hora y la escribe con el mismo formato, sin depender de la zona. No tiene estilos: hay uno solo.
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
