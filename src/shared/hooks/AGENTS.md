# Hooks: comportamiento compartido

Agrupa estado de URL, paginado, filtros, foco, migas, cuenta regresiva y guardas de salida. Comparte coordinación entre pantallas.

## Al modificar

- `useQueryUpdate` es el único escritor de query string; enviá filtro y reset de página en la misma llamada, porque dos cambios en el mismo tick se pisan.
- Su segundo argumento `{ replace: false }` crea una entrada sólo para elecciones de identidad, como conversación; mantiene replace por defecto para listados. `useUnsavedChangesGuard` acepta claves query opcionales que implican perder el editor; por defecto sigue bloqueando sólo pathname.
- Listados usan URL como estado y reemplazan historial. El tamaño resuelto de configuración se fija explícitamente en la URL; otros defaults se omiten. Limpiar filtros conserva orden.
- Los formularios en ruta propia usan guarda y hoja de migas; conservá `stay` después de `leave` y apagá la guarda mientras se guarda.
- Los diálogos montados al abrir usan `useRestoreFocusOnClose`; probá navegación y teclado, no solo estado interno.
- `useCountdown` conserva `initialSeconds` sólo al montar y `seconds`, `isRunning`, `restart` (incluido updater funcional). Calcula contra un deadline monotónico con `performance.now`; el timer sólo recalcula y `visibilitychange` visible recupera el plazo tras suspensión. Limpiá timer/listener al desmontar y verificá StrictMode, reinicio y consumidores de acceso/verificación. Es presentación: el servidor autoriza y define los plazos.

## Referencias

- [Listados y formularios](../../../docs/architecture.md).
- [Prueba de actualizaciones atómicas](useFilters.test.tsx).
- [Guarda de formulario](useUnsavedChangesGuard.ts).
- [Reloj controlado y ciclo del temporizador](useCountdown.test.tsx).
- [Regresiones de acceso y verificación](../../test/useCountdownConsumers.test.tsx).
