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

`usePrivateFormFile` coordina bytes autorizados por actor, idioma, respuesta y archivo, con `staleTime: Infinity`, sin refetch automático y señal de cancelación. Sólo se monta bajo valores autorizados; 401/403 quitan la proyección. Las URLs Blob son locales al elemento `PrivateImage` y se revocan al desmontar o cambiar contenido.

`PrivateFormFilesScopeProvider` retiene sólo miniaturas del ámbito explícito de respuestas (actor, cultura, permisos y formulario); cancela y retira todas sus claves al salir o cambiar ese dueño. Sin ámbito, chat conserva `gcTime: 0`; originales y documentos nunca se retienen tras desmontar. `FormRecordFiles` habilita la miniatura al entrar en el viewport mediante IntersectionObserver.

Las lecturas privadas de archivo declaran dueño local del error; el consumidor agrupa el aviso por respuesta. Montar el visor o volver a la pestaña no vuelve a bajar las miniaturas observadas.

`useQueryUpdate` admite pathname junto con los cambios de query para una navegación atómica (anterior/siguiente del detalle). Conserva los parámetros ajenos; sin pathname mantiene el comportamiento compartido de filtros.
