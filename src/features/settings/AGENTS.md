# Settings: política del sistema

Muestra y modifica los ajustes funcionales publicados por el backend.

## Al modificar

- La ruta y navegación requieren `settings.manage`; la autorización definitiva es del servidor.
- Cada zona de campos usa `Surface padded`, sin repetir el título de Page. Apariencia tiene ruta `/configuracion/apariencia` y vista previa en la UI compartida; guarda los cuatro colores juntos con revisión.
- Conservá nombres de enum y validación del contrato; los defaults de configuración no reemplazan la política persistida.
- La mutación invalida la consulta correspondiente y muestra éxito o error traducido. No escribir reglas de registro solo en el front.

## Referencias

- [Consultas, permisos y errores](../../../docs/architecture.md).
- [Política de ajustes](../../../../ArquitecturaBase/docs/features/administracion.md).


## Contrato vigente

`/configuracion` reúne cuatro ajustes en tres `Surface`: preferencias regionales, listados y registro.
Las cuatro rutas anteriores redirigen acá. Page comparte Guardar/Descartar, sin «Cambios sin guardar»
junto al título; tras un 409 o un guardado incierto, «Revisar valores actuales» va en la misma banda,
antes de Descartar, y las elecciones de `SettingsReview` van en el encabezado de su Surface. El PATCH
manda solo campos cambiados y expectedRevision, en un pedido atómico. Confirmar si cambia el registro.
`SettingsForm` compone los campos, `SettingsReview` la comparación y la página coordina el flujo.
Antes de abrir el editor, esperar la lectura fresca; luego un refetch no reemplaza el borrador.
Preservar el borrador ante un 409/500, consultar y comparar los cuatro valores antes de repetir.
Al conservar ediciones, adoptar cambios ajenos en campos no tocados. No suponer rollback.
La lectura usa el dueño global de QueryCache; la mutación y la relectura explícita tienen
dueño local por el emisor shared/ui/notifications. Validación por FormField/RadioGroupField.
No copiar helpers técnicos de errores, notificación o fechas en esta feature.

Al abrir el editor, esperar una lectura exitosa de ese montaje antes de sembrar valores y revisión;
la caché anterior no habilita la edición. Si falla, ofrecer Reintentar. Después de la siembra,
una consulta de fondo conserva el borrador y su revisión, incluso ante un error de carga.
