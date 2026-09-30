# Hooks: comportamiento compartido

Agrupa estado de URL, paginado, filtros, foco, migas, cuenta regresiva y guardas de salida. Comparte coordinación entre pantallas.

## Al modificar

- `useQueryUpdate` es el único escritor de query string; enviá filtro y reset de página en la misma llamada, porque dos cambios en el mismo tick se pisan.
- Listados usan URL como estado y reemplazan historial. El tamaño resuelto de configuración se fija explícitamente en la URL; otros defaults se omiten. Limpiar filtros conserva orden.
- Los formularios en ruta propia usan guarda y hoja de migas; conservá `stay` después de `leave` y apagá la guarda mientras se guarda.
- Los diálogos montados al abrir usan `useRestoreFocusOnClose`; probá navegación y teclado, no solo estado interno.

## Referencias

- [Listados y formularios](../../../docs/architecture.md).
- [Prueba de actualizaciones atómicas](useFilters.test.tsx).
- [Guarda de formulario](useUnsavedChangesGuard.ts).
