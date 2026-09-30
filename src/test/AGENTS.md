# Test: arnés del front

`setup.ts` prepara Vitest/jsdom y MSW; `mocks` contiene servidor y contratos simulados; `utils` renderiza con providers y router de la app.

## Al modificar

- Reutilizá `renderWithProviders` o `renderRouteWithProviders`; cada render aísla su QueryClient y no reintenta.
- Simulá HTTP con MSW y conservá formas de respuestas del backend. Los handlers de un escenario se restauran.
- Consultá por rol, texto accesible y comportamiento. Para páginas lazy esperá `findBy` o `waitFor`.
- Radix se abre por teclado en tests; revisá stubs de jsdom antes de cambiar producto para corregir una limitación del entorno.
- Layout, scroll, sticky y foco ocluido necesitan navegador: una assertion de clases no demuestra geometría.
- Mensajes: verificar canal y cantidad, recuperación y borrador además del texto. Las pruebas
  del dueño global usan la política real de QueryCache; aislar caché o apagar retries no debe
  quitar sus callbacks. La arquitectura limitará Toaster e imports de Sonner según el plan;
  esos controles todavía no están implementados.

## Referencias

- [Convenciones de pruebas](../../docs/architecture.md).
- [Compatibilidad y setup](setup.ts).
- [Render con providers](utils/renderWithProviders.tsx).
- [Contrato y cierre de mensajes](../../docs/guides/mensajes-y-estados.md#cuándo-se-puede-dar-por-unificada-una-pantalla).
