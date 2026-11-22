# Settings: política del sistema

Muestra y modifica los ajustes funcionales publicados por el backend.

## Al modificar

- La ruta y navegación requieren `settings.manage`; la autorización definitiva es del servidor.
- Cada zona de campos usa `Surface padded`, sin repetir el título de Page. Apariencia tiene ruta `/configuracion/apariencia` y vista previa en la UI compartida; guarda los cuatro colores juntos con revisión. «Restaurar colores iniciales» va en el encabezado de «Colores del sistema»; el estado del borrador no se muestra y la revisión de un conflicto se ubica como en `/configuracion`. Arriba de los colores, «Nombre y correos» (RC6-B): el nombre, el remitente y el logo van completos en `branding`, en el mismo PATCH y revisión que los colores, y «Así llega» muestra el correo de un código con el borrador.
- Conservá nombres de enum y validación del contrato; los defaults de configuración no reemplazan la política persistida.
- La mutación invalida la consulta correspondiente y muestra éxito o error traducido. No escribir reglas de registro solo en el front.

## Referencias

- [Consultas, permisos y errores](../../../docs/architecture.md).
- [Política de ajustes](../../../../ArquitecturaBase/docs/features/administracion.md).


## Contrato vigente

`/configuracion` reúne sus ajustes en cuatro `Surface`: preferencias regionales, listados, registro y «Privacidad y
retención» (RC1-A: los tres plazos del ingreso van completos en `retention`; el rango de cada uno, que repite el del
contrato, marca su cuadro sin mandar, y la (i) del título avisa que la política de privacidad tiene que prometer lo mismo).
Las cuatro rutas anteriores redirigen acá. Page comparte Guardar/Descartar, sin «Cambios sin guardar»
junto al título; tras un 409 o un guardado incierto, «Revisar valores actuales» va en la misma banda,
antes de Descartar, y las elecciones de `SettingsReview` van en el encabezado de su Surface. Hasta elegir,
Descartar y Guardar se apagan con «Primero revisá los valores actuales y elegí qué conservar.» como motivo
(`DisabledReason`), también en Apariencia. Cada lectura
lleva el foco al título de la comparación (`titleRef` de Surface), que aparece al final del contenido. El PATCH
manda solo campos cambiados y expectedRevision, en un pedido atómico. Confirmar si cambia el registro.
`SettingsForm` compone los campos, `SettingsReview` la comparación (sólo los ajustes distintos, lado a lado en
`ComparisonTable`, LR2-A) y la página coordina el flujo.
Antes de abrir el editor, esperar la lectura fresca; luego un refetch no reemplaza el borrador.
Preservar el borrador ante un 409/500, consultar y comparar los valores antes de repetir.
Al conservar ediciones, adoptar cambios ajenos en campos no tocados. No suponer rollback.
La lectura usa el dueño global de QueryCache; la mutación y la relectura explícita tienen
dueño local por el emisor shared/ui/notifications. Validación por FormField/RadioGroupField.
El idioma y «Filas por página» (10, 20, 50 y 100) van en un `SegmentedControl` dentro de su `FormField`; la zona
horaria, en la pieza para elegir (`Picker`) con la lista única de `timeZoneOptions`, que conserva la guardada, el alias
de Buenos Aires y `UTC` aunque el navegador no los liste (DS1-A).
No copiar helpers técnicos de errores, notificación o fechas en esta feature.

Al abrir el editor, esperar una lectura exitosa de ese montaje antes de sembrar valores y revisión;
la caché anterior no habilita la edición. Si falla, ofrecer Reintentar. Después de la siembra,
una consulta de fondo conserva el borrador y su revisión, incluso ante un error de carga.
