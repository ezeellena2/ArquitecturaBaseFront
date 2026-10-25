# Architecture: controles del front

Inspecciona fuentes productivas, dependencias entre áreas y reglas de uso del sistema visual. Sigue las instrucciones de `src/test`.

- Las reglas tienen ejemplos positivos y negativos y verifican los consumidores reales.
- `featureDependencies.test.ts` impide imports/reexports entre features y dependencias de shared hacia features, incluidos tipos e imports dinámicos literales, por alias o rutas relativas. No agregar excepciones para piezas comunes: ubicarlas en shared.
- Usar el AST de TypeScript: comentarios, alias de imports y constantes no deben producir resultados engañosos.
- Las features componen la biblioteca. Una necesidad nueva se implementa allí; no agregar exclusiones para conservar una copia local.
- `designArchitecture.test.ts` también impide que un locale vuelva a ofrecer «Cambios sin guardar» o «Unsaved changes» como estado (`unsavedStatusTexts`): un texto que lo nombra dentro de una frase, como el aviso de salida o la marca «Nuevo, sin guardar», no cuenta.
- Estas pruebas verifican límites, no geometría. Las medidas calculadas, scroll y capturas se prueban en `../visual`.

Referencia: [estándar aplicado](../../../docs/guides/estandar-visual.md).
