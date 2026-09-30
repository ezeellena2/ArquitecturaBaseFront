# Locales: textos y namespaces

Los JSON de `es` y `en` comparten un namespace por módulo. `common` agrupa solo textos de piezas usadas por varias áreas.

## Al modificar

- Una clave nueva se agrega en ambos idiomas, con voseo en español y placeholders equivalentes.
- Usá las formas plurales `_one` y `_other` cuando aparece `count`; no concatenar números con un sustantivo fijo.
- No decidir lógica por el texto de un error. La feature interpreta su código y elige la clave.
- Corré `parity.test.ts` y tests de componentes sensibles a nombre accesible cuando cambien sus textos.

## Referencias

- [Carga y preferencia de idioma](../shared/i18n/AGENTS.md).
- [Prueba de paridad](parity.test.ts).
- [Reglas de traducción](../../docs/architecture.md).
