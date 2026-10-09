# Panel de conversaciones: procedencia histórica

Elegido explícitamente y promovido al producto el 2026-10-05. Conserva las fuentes y evidencia
únicas del laboratorio; no es una entrada activa ni parte del build. Hereda la raíz.
No tomar el tablero chosen rechazado como referencia visual. El panel productivo vive dentro del chat.

- Sesión, conversaciones y respuestas son ficticias, sólo en memoria. El entry bloquea la API del asistente.
- No cargar un SDK/proveedor ni una biblioteca nueva. No importar este código en src.
- Escenarios es/en, 1440/390/320, panel abierto/plegado y drawer móvil; confirmar descarte y borrado.
- El título autorizado desde la primera pregunta vigente ya está implementado en el backend.
- La revisión compacta usa ThreadListPrimitive/ThreadListItemPrimitive y su menú More reales de
  assistant-ui 0.15.23. Sin fechas por fila, sin borrado directo ni búsqueda/renombrado/archivado sin contrato.
- El adaptador threadList de ExternalStore es experimental/deprecated en la versión instalada:
  el producto aísla esa frontera en AssistantRuntimeProvider y pruebas de regresión.
- No reactivar ni importar estas fuentes en src. Artifact privado: sincronización pendiente.

Plan: ../../../../ArquitecturaBase/docs/plans/2026-10-04-panel-conversaciones-inicio.md.
