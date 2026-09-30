# I18n: idioma de la interfaz

Configura i18next, carga namespaces y aplica idioma, preferencia local y `lang` del documento.

## Al modificar

- Español e inglés deben tener las mismas claves y placeholders. Las pantallas piden el namespace del módulo.
- Antes de sesión se usa el default general salvo elección pública explícita en su clave separada; con cuenta se persiste mediante `useLanguagePreference` y se revierte si falla.
- El idioma de la cuenta prevalece al cargar el perfil. `Accept-Language` viaja desde el cliente común.
- No tocar `document.lang` desde una pantalla ni introducir un segundo mecanismo de selección.

## Referencias

- [Idioma en dos niveles](../../../docs/architecture.md).
- [Guardado de preferencia](../../auth/useLanguagePreference.ts).
- [Paridad de traducciones](../../locales/parity.test.ts).

`PublicPresentationDefaults` no toma la preferencia histórica de una cuenta como elección pública.
