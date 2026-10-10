# Visual: catálogo y navegador

Contiene el catálogo local, fixtures y las pruebas Playwright del sistema visual. Hereda `src/test`.

- La entrada HTML y las rutas de catálogo son de pruebas; nunca agregarlas a `app/routes` ni al build productivo.
- Usar componentes y rutas reales, con datos ficticios tipados. No reconstruir una pantalla para que la captura pase.
- El fetch simulado se instala solo desde esta entrada y no llama ni escribe a una API real.
- `business-guided.spec.ts` recorre BusinessInformationPage real con el escenario business-guided en es/en a 1440/390/320: Places doblado, teclado, selección/enlace, limpieza al editar dirección, horarios/fechas/FAQ. Sin claves ni servicios facturables. Guardado/sesión simulados; no acredita Google, persistencia ni WhatsApp reales. MSW verifica cuerpos/UUID; Docker acredita persistencia aparte.
- `session.html` inicia una sesión ficticia y `session.spec.ts` intercepta HTTP con Playwright: ejercen el proveedor OIDC, logout, código y callback reales al cambiar de cuenta desde distintas rutas. No envían correos ni cambian cuentas reales.
- `assistant.spec.ts` compone el Inicio real con assistantFixtures tipados: once estados, es/en, 1440/390/320, aceptación incierta/cooldown, scroll anclado al leer, GET fallido y borrado confirmado. Datos, API y sesión ficticios no acreditan generación facturable ni PostgreSQL. `landing.spec.ts` instala el mismo handler de renovación anónima en todos sus casos públicos, incluido contraste.
- Esperar contenido y fuentes; verificar geometría, teclado y retorno de foco además de imágenes.
- Las comprobaciones de pedidos externos usan el origen de baseURL del proyecto, sin puertos fijos. Conservar la lista estricta de proveedores permitidos; una ejecución aislada no habilita llamadas adicionales.
- `role-groups.spec.ts` comprueba el botón global de permisos en es/en a 1440/390/320, con Admin de sólo lectura, teclado y filtros. `business-place-proposal.spec.ts` verifica únicamente la propuesta `ubicacion-lugar`, incluidos recortes de botones y descarte; enlaces ficticios, sin abrir Google Maps ni guardar en la API.
- Una diferencia se revisa; actualizar capturas requiere una decisión visual autorizada. No usar la actualización como reparación automática.
- Playwright levanta Vite en 5178 y lo detiene al terminar. Diagnósticos en `test-results`, capturas de referencia en `screenshots`.

Referencia: [estándar aplicado](../../../docs/guides/estandar-visual.md#catálogo-y-revisión-con-navegador).

`assistant-conversations.spec.ts` recorre panel real en es/en a 1440/390/320: listado de 24 filas en páginas de 20, drawer, borrador, selección, menús/Escape, cancelación de borrado y devolución del foco. El fetch ficticio instrumenta GET/escrituras en memoria para probar navegación sin generación. Reloj congelado sólo de tests; no acredita capacidad ni proveedor real.

`formPublicationReads.spec.ts` recorre recarga Failed/listado/diagnóstico y P3 por idioma/vencimiento; `chatForms.spec.ts` recorre C1–C5 sobre Inbox/Thread/Composer/Timeline reales. Ambos cubren es/en y1440/390/320, teclado, foco, geometría y capturas. formFixtures/chatFormFixtures simulan estado durable y cola en memoria; el iframe oficial se intercepta con HTML ficticio identificado y nunca llama a Meta. Estas pruebas no acreditan sesiones, cola durable, entrega ni publicación reales.

`formSharedControls.spec.ts` verifica RadioGroupField cards y MessageCard dentro de MessageBubble en el catálogo es/en a1440/390/320; las referencias del catálogo existente se conservan y se verifican sin actualizar capturas automáticamente.

formReview.spec recorre foco al ordenar preguntas/opciones, Listo y quita hasta el último elemento, y renderiza Published/Failed desde la cohorte HTTP sintética del backend sin modificar sus cuerpos. es/en a1440/390/320, lectura sin escrituras, idioma/control afectado y geometría. Las facetas del escenario siguen simuladas; usar cuerpos HTTP reales no acredita Meta ni el transporte de esta sesión de navegador a PostgreSQL.
