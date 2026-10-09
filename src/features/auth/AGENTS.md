# Auth feature: pantallas de acceso

Muestra bienvenida pública, ingreso, registro, código, enlace de un solo uso y callback. Orquesta la interfaz usando la sesión compartida y contratos del backend.

## Al modificar

- La landing aprobada de `/` compone `PublicLanding`: marca genérica, introducción y capacidades,
  con acceso principal y registro solo si el servidor lo habilita. `AuthLayout` conserva idioma y
  navegación; con sesión se muestra el tablero. La elección está en el fundamento visual.

- El código WhatsApp se pide y verifica desde la web aunque el chat esté en Manual. La invitación abre `/login` mediante orientación pública; los enlaces pendientes siguen en `/ingresar`. Nunca pedir autenticación por frases al chat.

- El backend define métodos disponibles y si el registro está abierto. Conservá intención ingreso/registro y la comprobación final del servidor.
- Prepará OIDC en el SPA y validá `returnUrl`; el nombre de registro viaja en estado de ruta y solo se guarda al crear la cuenta.
- Un enlace lee el token del fragmento en el primer render y limpia la barra; preview no consume y Continuar consume una sola vez.
- Canal, destino enmascarado y plazo de reenvío se conservan en el flujo de código. Los errores definitivos frenan verificar y reenviar.
- El país y teléfono se envían al backend sin normalizar. Los campos, código y errores comunes se reutilizan con perfil.

## Referencias

- [Flujos de acceso y enlaces](../../../docs/architecture.md).
- [Reglas del backend](../../../../ArquitecturaBase/docs/features/identidad.md).
- [Oferta pública de medios](../../shared/api/loginMethods.ts).
