# Lib: utilidades puras del front

Contiene formato de fechas por zona, de números y de valores tipados, nombres de países y `cn`. Son mecanismos reutilizables sin lógica de una feature.

## Al modificar

- **Una fecha se muestra siempre con números: `dd/MM/yyyy` en español (`03/11/2026`) y `MM/dd/yyyy` en inglés.** Nunca el mes en letras («3 nov 2026», «Nov 3, 2026»), nunca `dateStyle` ni un formato propio de una pantalla (2026-11-10). Las tres funciones comparten `dayOptions`; con hora, el resto es `HH:mm` (`03/11/2026, 21:00`).
- `formatDateInZone` sirve para fechas, `formatDateTimeInZone` para detalles y `formatTimeInZone` para horas de mensajes. `calendarDateInZone` da identidad de día local para agrupaciones, independiente del idioma. No agregar formateadores locales ni mostrar UTC crudo.
- **Un número se muestra con el estándar CLDR de la región de su idioma: es-AR en español (`1.210`, `1.234,5`) y en-US en inglés (`1,210`, `1,234.5`)** (2026-11-12). `numberFormat` es el único formateador de números y `formatNumber` escribe con él; pasan por ahí `decimal`, `fileSize`, `typedValue`, los tableros y los números de un texto (shared/i18n). Un `Intl.NumberFormat` o un `toLocaleString` sueltos los frena `designArchitecture.test.ts`. Un identificador no es un número: va como texto.
- `dateTime` y `numberFormat` guardan un `Intl.*Format` por idioma, zona y opciones (2026-11-07): crearlo cuesta unas cien veces más que usarlo, y un historial o una tabla formatea en cada render. Una función de formato nueva reusa esos mapas en lugar de construir uno por llamada.
- `formatDateOnly` valida una fecha sin hora y la escribe con el mismo formato, sin depender de la zona. No tiene estilos: hay uno solo.
- `typedValue` es el único formato de valores tipados (entero, decimal, fecha sin hora, sí/no) en tablas, importación, resúmenes, respuestas y el chat: `formatTypedValue` agrupa los números exactos (es-AR o en-US) y muestra la fecha numérica, y devuelve null si el valor no es canónico; `formatYesNo` nombra sólo true y false. Las fechas con hora siguen con `formatDateInZone`/`formatDateTimeInZone`.
- `cn` se reexporta desde `utils`; no agregar otra librería para combinar clases.
- `formatFileSize` (`fileSize`) escribe el tamaño de un archivo: KB enteros bajo el mega (nunca cero) y MB con un decimal, en el idioma del menú; lo usan los archivos de una respuesta y los del asistente.
- El front envía país y número al backend: no implementar normalización telefónica acá.
- Una utilidad nueva necesita un consumidor compartido y pruebas de su comportamiento cuando tenga lógica.

## Referencias

- [Fechas y utilidades](../../../docs/architecture.md).
- [Formato común de fechas](dateTime.ts).
- [Formato común de números](numberFormat.ts).
- [Formato común de valores tipados](typedValue.ts).
- [Combinación de clases](utils.ts).

- `appearance` define la paleta inicial Campo, valida colores y deriva contraste de texto, foco y hover.
  No cambia success/warning/danger. Los valores explícitos iniciales permiten que la vista previa
  del borrador quede independiente de la paleta guardada.
