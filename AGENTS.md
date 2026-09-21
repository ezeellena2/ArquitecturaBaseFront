# ArquitecturaBaseFront: guía para Codex

`CLAUDE.md` es la guía canónica de arquitectura, flujo de trabajo y convenciones de este repositorio. Leela completa antes de modificar código.

Para cualquier trabajo visual, de UX o de nuevas pantallas, leé además `docs/design/visual-baseline.md`. Ese documento es el contrato visual versionado compartido por Codex y Claude; el Artifact externo queda registrado allí como procedencia, no como única fuente.

Reglas adicionales:

- Antes de programar una pantalla nueva, dibujala como tablero en el Artifact del sistema visual (el enlace está en `docs/design/visual-baseline.md`) con su funcionalidad completa: estados de carga, vacío y error, qué pasa sin permiso, el recorrido de diálogos y qué vive en la URL. Se programa después de una elección explícita del usuario; programar primero y dibujar después no cuenta.
- No copies una maqueta a ciegas: contratos funcionales, permisos, accesibilidad, i18n y manejo de errores del repositorio tienen precedencia.
- Las decisiones aprobadas terminan en tokens de `src/index.css`, componentes de `src/shared/ui` y tests; no quedan solamente documentadas.
- Para explorar alternativas con la skill `variant`, acotá cada ronda a una pieza, usá tres variantes sobre un único eje y mantené el laboratorio aislado. No promociones ninguna sin elección explícita del usuario.
- Al promover una variante, integrá solo la elegida y eliminá el selector, el arnés y las descartadas.
