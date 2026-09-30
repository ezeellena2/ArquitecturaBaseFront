# Profile: cuenta propia

Muestra medios de ingreso y datos del perfil. Comparte verificación de destinos con acceso y conserva reglas del último medio de ingreso.

## Al modificar

- `PUT /api/me` reemplaza nombre, idioma y zona: enviá los tres aunque cambie uno.
- Correo y número usan verificación por destino con el diálogo común; la oferta de vincular depende del backend.
- El único medio de ingreso no se desvincula. Ante el conflicto correspondiente, volvé a consultar el perfil.
- Conservá formato de teléfono, estados de verificación y mensajes para destino ocupado; no inferir una cuenta solo desde correo.
- Los cambios refrescan usuario actual y preferencia de idioma. No modificar la sesión por un desvínculo que debe conservarla.

## Referencias

- [Perfil y medios de ingreso](../../../docs/architecture.md).
- [Contrato de perfil](../../shared/api/profile.ts).
- [Verificación e identidad](../../../../ArquitecturaBase/docs/features/identidad.md).
