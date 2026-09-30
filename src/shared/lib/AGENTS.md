# Lib: utilidades puras del front

Contiene formato de fechas por zona, nombres de países y `cn`. Son mecanismos reutilizables sin lógica de una feature.

## Al modificar

- `formatDateInZone` sirve para listados y `formatDateTimeInZone` para detalles. No agregar formateadores locales ni mostrar UTC crudo.
- `cn` se reexporta desde `utils`; no agregar otra librería para combinar clases.
- El front envía país y número al backend: no implementar normalización telefónica acá.
- Una utilidad nueva necesita un consumidor compartido y pruebas de su comportamiento cuando tenga lógica.

## Referencias

- [Fechas y utilidades](../../../docs/architecture.md).
- [Formato común de fechas](dateTime.ts).
- [Combinación de clases](utils.ts).
