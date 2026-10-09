# Corrección de Inicio y recuperación de rutas

2026-10-04. El usuario rechazó la implementación que convirtió el chat elegido en un formulario
y reportó Failed to fetch dynamically imported module al abrir WhatsApp. Trabajo directo sobre
main, sin ramas, commits ni push; cambios anteriores preservados.

## Referencia y cambio

Referencia original: assistant-ui-empty/answer-*.png en
design-lab/history/home-assistant-comparison-2026-10-04/evidence. Las capturas chosen-board
introducidas durante la integración no acreditan aprobación de otra composición.

shared/ui/assistant conserva primitivas reales y restituye marco a toda el área disponible,
columna de 704 px/16 px de padding, bienvenida/editor centrados, sugerencias debajo en vacío,
editor al pie en conversación, radio de 16 px, envío por flecha y burbuja de usuario.
Disponibilidad compacta junto al editor; validación asociada y etiqueta/atajo accesibles.
No controles ficticios de adjuntos/regeneración. Page viewport es optativo; las otras pantallas
conservan su composición. No se modificaron servicios, transporte, permisos, fuentes,
useCountdown ni formatos de fecha. La UI no habilita una conexión sin configurar.

RouteErrorPage es un ErrorBoundary estático es/en. Protege la rama privada dentro del
caparazón y la carga inicial desde el límite raíz; ofrece recarga explícita y no reintenta
escrituras. HydrateFallback presenta Spinner durante la carga inicial.

## Verificación

- Build TypeScript/Vite y lint: verdes; arquitectura, 48 pruebas.
- Vitest completo: 95 archivos, 1009 pruebas en verde.
- WhatsApp real con API/sesión ficticias: seis recorridos es/en a 1440/390/320, en verde.
- TDD de navegador: cuatro casos nuevos fallaron antes de implementar la composición y la
  recuperación. Se ajustó una comprobación de ayuda sr-only: Playwright considera visible
  un elemento de 1 px; la geometría verifica que no aparezca como párrafo del formulario.
- Asistente + contrato visual/recuperación: 75 casos finales en verde. Once estados, es/en,
  1440/390/320, teclado, envío, fuentes, borrador, incertidumbre, espera y scroll.
- Regresión visual completa: 189 casos en verde. La revisión posterior encontró sugerencias
  recortadas dentro del hilo a 320 px; dos pruebas nuevas fallaron y se corrigió el ancho máximo
  de los chips. Los 75 casos finales cubren esa corrección; las otras 116 rutas/recorridos de
  la regresión completa no cambiaron. Build/lint se repitieron después del ajuste.
- Corte deliberado del módulo de WhatsApp: error traducido, retirada del bloqueo y recarga
  permiten volver a abrir la ruta en ambos idiomas.
- Se revisaron capturas del producto contra la referencia original, incluidos vacío,
  conversación y falta de configuración en móvil. Se actualizaron sólo referencias assistant-*.

## Límites y diagnósticos

Las pruebas de navegador usan los componentes/rutas reales y contratos ficticios; no acreditan
conexión real con WhatsApp, proveedor LLM ni persistencia. En la inspección del incidente,
localhost:5173 no estaba escuchando por HTTP ni HTTPS. El build resolvió WhatsAppChatPage
y la ruta funcionó en Vite nuevo. La captura por sí sola no identifica si hubo reinicio,
desconexión o invalidación de dependencias. La causa puntual requiere la sesión de desarrollo
levantada y sus respuestas/logs; el límite de error no se presenta como solución del servidor.
El usuario confirmó que detuvo la aplicación después del error, por eso la ausencia actual
del puerto no se presenta como causa original. No se relanzó la instalación ni se modificó
su configuración para sustituir la evidencia que falta.

Vitest emitió avisos act de providers/Toaster y pedidos MSW sin handler desde pruebas de
navegación de Sidebar (roles/paged, users y filter-counts). Se localizaron en esos arneses,
no se silenciaron ni se interpretan como errores de una API real. Playwright/Node avisan
NO_COLOR/FORCE_COLOR del entorno. Build y lint no emitieron advertencias de código.
Sólo se detuvieron los procesos Vite iniciados por estas verificaciones; no se inició Aspire
ni se interrumpieron Visual Studio, API o los servidores previos del laboratorio.
