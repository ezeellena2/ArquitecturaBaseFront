# Test: arnés del front

`setup.ts` prepara Vitest/jsdom y MSW; `mocks` contiene servidor y contratos simulados; `utils` renderiza con providers y router de la app.

## Al modificar

- Reutilizá `renderWithProviders` o `renderRouteWithProviders`; cada render aísla su QueryClient y no reintenta.
- Simulá HTTP con MSW y conservá formas de respuestas del backend. Los handlers de un escenario se restauran.
- fixtures/forms-http y fixtures/whatsapp-forms-http conservan bytes sintéticos de respuestas reales de ApiFactory con SHA256/procedencia. Los consumidores de contrato leen FORMS_HTTP_CONTRACT_INPUT y WHATSAPP_FORMS_HTTP_CONTRACT_INPUT, respectivamente, para validar una salida nueva del productor backend. Las páginas de WhatsApp sirven los cuerpos crudos, incluido el hilo previo al envío, sin fabricar tarjetas ni quitar operaciones. No serializar DTOs a mano como prueba de contrato real; los dobles complementan comportamiento y no acreditan Meta.
- Consultá por rol, texto accesible y comportamiento. Para páginas lazy esperá `findBy` o `waitFor`.
- Radix se abre por teclado en tests; revisá stubs de jsdom antes de cambiar producto para corregir una limitación del entorno.
- Layout, scroll, sticky y foco ocluido necesitan navegador: una assertion de clases no demuestra geometría.
- `architecture` comprueba dependencias entre features, independencia de shared y límites del sistema visual; `visual` tiene el catálogo con componentes reales y Playwright. Sus capturas y geometría completan Vitest; la entrada y los dobles son exclusivamente de pruebas.
- Mensajes: verificar canal y cantidad, recuperación y borrador además del texto. Las pruebas
  del dueño global usan la política real de QueryCache; aislar caché o apagar retries no debe
  quitar sus callbacks. La arquitectura visual verifica el montaje único de Toaster; los límites
  de imports directos de Sonner y la migración de canales siguen el plan transversal.

## Referencias

- [Convenciones de pruebas](../../docs/architecture.md).
- [Compatibilidad y setup](setup.ts).
- [Render con providers](utils/renderWithProviders.tsx).
- [Contrato y cierre de mensajes](../../docs/guides/mensajes-y-estados.md#cuándo-se-puede-dar-por-unificada-una-pantalla).

`fixtures/catalogs-http/manual` conserva15 cuerpos HTTP históricos de FormCatalogEndpointsTests y el manifiesto emitido por su runner, sin cambios en bytes ni hashes escritos a mano. `catalogHttpContract.test` verifica tamaños/SHA256 históricos; los campos nuevos ausentes se rechazan. La full Vitest excluye .test-artifacts (probes temporales de QA) y usa maxWorkers:1: esa concurrencia pasó1542/1542 sin ampliar5000ms ni alterar assertions, después de diagnosticar el caso lazy de80impedimentos. No editar configuración/build durante un Vite visual activo; conservar fulls fallidas y verificaciones focales por separado.

Las cohortes actuales `catalogs-http/filters` (8 cuerpos) y `manual-current` (15) se copian byte a byte de las salidas HTTP K4 del productor, separadas de Manual histórico. `catalogFilters.test` consume los requests/receipts/preview/detalle exactos y `CatalogEditorPage.test` reproduce el request capturado sobre detalle/opciones reales. Cada cohorte tiene su provenance.json automático del runner backend, copiado sin cambios; .gitattributes evita que core.autocrlf normalice estos exports actuales al guardarlos en Git: catalogFilters.test y catalogCurrentHttpContract.test verifican todos los tamaños/SHA256. FORMS_CATALOG_FILTER_HTTP_CONTRACT_INPUT apunta a catalog-filters; FORMS_CATALOG_HTTP_CONTRACT_INPUT al directorio productor que contiene manual-bilingual. La cohorte final procede de forms-step7-final (focal122/122), con repositoryHead y sourceState originales; no se atribuye a un HEAD posterior ni convierte la full backend2708/2710 en verde.
