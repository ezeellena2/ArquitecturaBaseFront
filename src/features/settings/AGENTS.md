# Settings: política del sistema

Muestra y modifica los ajustes funcionales publicados por el backend.

## Al modificar

- La ruta y navegación requieren `settings.manage`; la autorización definitiva es del servidor.
- Conservá nombres de enum y validación del contrato; los defaults de configuración no reemplazan la política persistida.
- La mutación invalida la consulta correspondiente y muestra éxito o error traducido. No escribir reglas de registro solo en el front.

## Referencias

- [Consultas, permisos y errores](../../../docs/architecture.md).
- [Política de ajustes](../../../../ArquitecturaBase/docs/features/administracion.md).


## Contrato vigente

Cuatro rutas: idioma, zona-horaria, listados y registro; /configuracion redirige a idioma.
Cada una edita un campo y manda PATCH con expectedRevision. Preservar el borrador ante un
409/500, consultar los valores actuales y comparar antes de repetir; no suponer rollback.
La lectura usa el dueño global de QueryCache; la mutación y la relectura explícita tienen
dueño local por el emisor shared/ui/notifications. Validación por FormField/RadioGroupField.
No copiar helpers técnicos de errores, notificación o fechas en esta feature.
