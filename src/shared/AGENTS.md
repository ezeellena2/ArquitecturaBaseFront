# Shared: piezas entre áreas

Contiene cliente y contratos HTTP comunes, hooks, utilidades, i18n y sistema de UI. No pertenece a una feature concreta.

## Al modificar

- Una pieza compartida no importa features. Mantené la API mínima que necesitan los consumidores reales.
- Antes de crear una utilidad o componente, buscá el existente; preservá una sola implementación para clases, fechas, formularios y errores comunes.
- Un cambio afecta varias pantallas: verificá consumidores, accesibilidad, idioma y tests de la pieza.
- Las decisiones visuales se expresan en tokens y biblioteca compartida, además del código.

## Referencias

- [Convenciones compartidas](../../docs/architecture.md).
- [Sistema visual](../../docs/design/visual-baseline.md).
- [Namespaces y paridad](../locales/AGENTS.md).
