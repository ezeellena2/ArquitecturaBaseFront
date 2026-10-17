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

Las familias activas `catalogs-http/filters` (8 cuerpos) y `manual-current` (15) conservan los requests, receipts, preview y detalle exportados por los productores HTTP. `.gitattributes` evita que `core.autocrlf` normalice sus bytes. Los consumidores verifican todos sus tamaños/SHA256 mediante `httpCohort`; cada variable de entrada apunta directamente al directorio de la cohorte declarado allí. El export conjunto reemplaza íntegramente cuerpos y manifiesto, sin atribuir los exports K4 anteriores a otra corrida.

`fixtures/forms-responses-http` conserva cuerpos HTTP y el XLSX de FormResponseHttpTests/WhatsAppFormFilesIntegrationTests, con provenance.json del exportador backend. responseHttpContract.test comprueba bytes, esquemas y lectura por los adaptadores reales; no serializar dobles para presentarlos como respuesta del productor.

Las cohortes de Etapa4 y acciones de WhatsApp usan `httpCohort`: verifica bytes/SHA256 y procedencia de la única corrida backend, con el mismo runId/HEAD en todos sus destinos. Los nuevos consumidores *HttpContract de Etapa4 y stage4HttpProvenance se ejecutan sólo después de exportar; no crear fixtures ni normalizar cuerpos para hacerlos pasar. Los binarios PDF usan los companions .http.json del productor para status y headers reales.

El cierre conjunto incluye las cohortes declaradas en httpCohort: httpCohort y stage4HttpProvenance incorporan whatsapp-forms-http manual junto a whatsapp-form-actions-http. El inventario admite rutas relativas es/en y conserva bytes, tamaños y SHA; fuente/runId/HEAD deben pertenecer a la misma corrida completa. httpCohort.test usa archivos temporales marcados como sintéticos sólo para probar inventario plano/anidado e integridad: no son capturas backend ni sustituyen el export final.

forms-suggestions-http suma la configuración de sugerencias exportada por FormSuggestionHttpTests (FORM_SUGGESTIONS_HTTP_OUTPUT); el consumidor usa FORMS_SUGGESTIONS_HTTP_CONTRACT_INPUT. SourceVersionId y DestinationVersionId son capturados; ConditionChoices es requerido en options. suggestionsHttpContract y la procedencia conjunta se corren sólo tras el export final. No crear los cuerpos a mano para esos tests; la fila sintética de httpCohort.test sólo prueba la entrada del helper y sus bytes temporales.

forms-catalog-proposals-http conserva las seis respuestas de FormCatalogProposalHttpTests (FORM_CATALOG_PROPOSAL_HTTP_OUTPUT). catalogProposalHttpContract usa FORMS_CATALOG_PROPOSALS_HTTP_CONTRACT_INPUT, sin ejecutar el consumidor hasta el export final; httpCohort prueba el inventario aparte con archivos temporales sintéticos y exige artifactSet catalog-proposals. Los DTO propuestos llevan Proposal requerido nullable; no inyectar null en los cuerpos capturados anteriores para hacerlos pasar.

forms-suggestion-detail-http suma detail-es/en de FormSuggestionCaptureIntegrationTests (FORM_SUGGESTION_DETAILS_HTTP_OUTPUT). suggestionDetailHttpContract usa FORMS_SUGGESTION_DETAILS_HTTP_CONTRACT_INPUT y sólo se ejecuta después del export conjunto. assistance.suggestion conserva Always histórico aunque la configuración actual cambió; no completar cuerpos anteriores ni fabricar nodos de cadena.

whatsapp-audio-http suma tres cuerpos de WhatsAppChatTests.Audio (WHATSAPP_AUDIO_HTTP_OUTPUT). audioHttpContract usa WHATSAPP_AUDIO_HTTP_CONTRACT_INPUT y verifica request Pending y páginas Pending/Completed sin reescribir bytes; se ejecuta sólo después del export final. Los dobles de comportamiento/audio son sintéticos explícitos y no acreditan reproducción real del proveedor.

La familia missingRequests lee forms-missing-requests-http con FORMS_MISSING_REQUEST_HTTP_CONTRACT_INPUT; el productor real FormMissingRequestHttpTests exporta seis cuerpos agregados/es/en y sus límites403/409. No se fabrican muestras mientras la integración final está pendiente.

La familia whatsappAssistant lee whatsapp-assistant-http con WHATSAPP_ASSISTANT_HTTP_CONTRACT_INPUT. WhatsAppAssistantHttpTests y su partial Suggestions emiten doce cuerpos físicos: seis estados de sugerencia manual, recibo, los dos hilos con/sin RecordsRead y tres respuestas Always reales (preview, hilo y recibo). Always conserva ProposalId null, puntero de FlowReply y notInstalled del enum de disponibilidad; no se crean cuerpos mientras falta el export. El consumidor conserva bytes y proyección privada; su ejecución espera el exportador final.

Las seis familias heredadas activas usan ahora el mismo manifiesto: forms (28), manualCatalogs (15), catalogFilters (8), catalogSource (11), formFiles (5) y whatsappCatalogs (26). Sus consumidores exigen los nombres exactos y los bytes íntegros de la corrida común; httpCohort declara cada carpeta y variable de entrada. catalogs-http/manual conserva el contrato histórico anterior a K4 y su procedencia original; no se regenera ni se atribuye al nuevo backend. Los subtrees producidos por FORMS_HTTP_CONTRACT_OUTPUT se separan por destino, sin mezclar pedidos/otras capturas.
