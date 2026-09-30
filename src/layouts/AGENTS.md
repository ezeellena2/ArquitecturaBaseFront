# Layouts: caparazón y navegación

Define layouts de acceso, inicio y aplicación autenticada, además de barra, menú, sidebar y migas.

## Al modificar

- Ruta y menú mantienen los mismos permisos. Las rutas hijas usan la sección padre; la pantalla aporta la hoja de sus migas.
- `AppLayout` tiene alto `h-svh` y scroll en `main`, con posición relativa y espacio de scroll para el encabezado adherido. Preservá impresión y foco visible.
- No agregar scroll de página que rompa `Page`; un cambio de geometría se verifica en navegador porque jsdom no maqueta.
- Los controles usan `ActionTooltip` e `IconButton` compartidos y textos traducidos. La preferencia de idioma se sincroniza con la cuenta.

## Referencias

- [Navegación, scroll y accesibilidad](../../docs/architecture.md).
- [Caparazón aprobado](../../docs/design/visual-baseline.md).
- [Encabezado y cuerpo compartidos](../shared/ui/Page.tsx).
