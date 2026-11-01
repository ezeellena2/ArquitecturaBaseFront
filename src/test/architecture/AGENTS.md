# Architecture: controles del front

Inspecciona fuentes productivas, dependencias entre áreas y reglas de uso del sistema visual. Sigue las instrucciones de `src/test`.

- Las reglas tienen ejemplos positivos y negativos y verifican los consumidores reales.
- `featureDependencies.test.ts` impide imports/reexports entre features y dependencias de shared hacia features, incluidos tipos e imports dinámicos literales, por alias o rutas relativas. No agregar excepciones para piezas comunes: ubicarlas en shared.
- Usar el AST de TypeScript: comentarios, alias de imports y constantes no deben producir resultados engañosos.
- Las features componen la biblioteca. Una necesidad nueva se implementa allí; no agregar exclusiones para conservar una copia local.
- `designArchitecture.test.ts` también impide que un locale vuelva a ofrecer «Cambios sin guardar» o «Unsaved changes» como estado (`unsavedStatusTexts`): un texto que lo nombra dentro de una frase, como el aviso de salida o la marca «Nuevo, sin guardar», no cuenta.
- La regla `legend` de `inspectDesign` frena las leyendas explicativas (decisión del usuario, 2026-10-31): un `t("clave")` sin valores en el `hint` de `FormField`/`PhoneField`, la `description` de `CheckboxField`, de una opción de `RadioGroupField` o de `EmptyState`, o en `DialogDescription`. La explicación va en `help` (la (i)); un texto con valores es un dato y no cuenta. No ve un párrafo suelto. Una leyenda que el usuario aprobó conservar porque no explica cómo funciona algo va en `keptLegends` de `designArchitecture.test.ts`, por archivo y clave y con su motivo; no se excluye un archivo entero.
- Estas pruebas verifican límites, no geometría. Las medidas calculadas, scroll y capturas se prueban en `../visual`.

Referencia: [estándar aplicado](../../../docs/guides/estandar-visual.md).
