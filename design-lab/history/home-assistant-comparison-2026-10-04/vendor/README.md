# Componentes de los registros oficiales

Snapshots descargados el 2026-10-04. `manifest.json` conserva los URLs de los registros.
Las licencias originales están en `LICENSE.*.txt`.

- assistant-ui: Thread y sus piezas del registro https://r.assistant-ui.com/thread.json.
- AI Elements: Conversation, Message y PromptInput de https://elements.ai-sdk.dev/api/registry/.
- shadcn/ui: controles base de su registro oficial. Button usa new-york-v4 para los tamaños
  que exige la versión actual de AI Elements; el resto usa los registros new-york declarados.
- Los hooks `use-copy-to-clipboard` y `use-attachment-src` vienen del registro de assistant-ui.
- `utils/href.ts` viene de
  https://github.com/assistant-ui/assistant-ui/blob/main/packages/ui/src/components/react/assistant-ui/utils/href.ts.

Adaptaciones del laboratorio: resolución de imports, traducción de los textos principales del
Thread y el enlace a los recursos locales. Las formas y mecánicas de las piezas siguen siendo
las de las bibliotecas. No se reconstruyen burbujas/compositor con una imitación propia.
Los snapshots ajenos al código productivo se excluyen de Oxlint de forma acotada; sus tipos y
el comportamiento montado sí se verifican con TypeScript y Playwright.
