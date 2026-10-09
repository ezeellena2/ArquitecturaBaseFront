# Tablero de Inicio con asistente

assistant-ui elegido e implementado el 2026-10-04. Este ámbito conserva el tablero previo y evidencia. Hereda la raíz,
arquitectura y contrato visual. Usa AppLayout/Page y controles reales de shared/ui.

- Entrada aislada del router/build productivos, sesión ficticia en memoria y fixtures locales.
- Consultas, generación, historial, cancelación y borrado son simulados. No enviar contenido a APIs.
- No copiar bootstrap, escenarios o datos de este laboratorio al producto.
- Textos es/en y estados responsive; conservar Campo/Public Sans y controles compartidos.
- El panel `conversations` fue elegido y promovido; su procedencia única queda inactiva en `../history/home-assistant-conversations-2026-10-05`.
  `chosen` conserva la integración previa rechazada como formulario; no es una aprobación visual.
  Las comparaciones, vendor y dependencias descartadas viven recuperablemente en
  `../history/home-assistant-comparison-2026-10-04`.
- No ofrecer selector de bibliotecas ni presentar las comparaciones archivadas como propuestas vigentes.

Diseño: [propuesta](../../docs/design/inicio-asistente-propuesta.md).
Arquitectura: [plan](../../../ArquitecturaBase/docs/plans/2026-10-04-inicio-asistente.md).
