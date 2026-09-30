# UI: biblioteca compartida

Reúne primitivas generadas por shadcn y componentes propios de formularios, tablas, diálogos, navegación y presentación. Toda pantalla usa esta biblioteca y los tokens globales.

## Al modificar

- Los archivos en minúscula son generados y se editan lo mínimo; los propios usan PascalCase. Al regenerar, preservá traducciones y tema claro de Dialog y Sonner.
- Usá `Page`, `RowActions`, `ActionTooltip`, `IconButton`, `FilterBar` y campos comunes. No agregar variantes locales de un mismo control.
- Conservá nombre accesible, foco, teclado, portales y ayuda de acciones deshabilitadas. Textos compartidos van en `common`.
- Un cambio visual se contrasta con la biblioteca y el contrato aprobado. Las decisiones nuevas pasan por tablero y elección antes de implementarse.
- Tests consultan por rol y texto; los de i18n y tema evitan regresiones de componentes generados.
- El único Toaster se monta en AppProviders y fija la política común. No promover un FormError
  general ni usar Banner para resultados operativos. Comprobar avisos desde Dialog con teclado,
  sin cambiar la modalidad ni crear otro Toaster.

## Referencias

- [Biblioteca y decisiones visuales](../../../docs/design/visual-baseline.md).
- [Reglas de componentes y accesibilidad](../../../docs/architecture.md).
- [Compatibilidad de Radix con jsdom](../../test/setup.ts).
- [Premisas de desarrollo de pantallas](../../../docs/guides/premisas-de-desarrollo.md).
- [Contrato de mensajes y estados](../../../docs/guides/mensajes-y-estados.md).
