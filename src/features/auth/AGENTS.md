# Auth feature: pantallas de acceso

Muestra bienvenida pública, ingreso, registro, código y callback. Orquesta la interfaz usando la sesión compartida y contratos del backend.

## Al modificar

- La landing aprobada de `/` compone `PublicLanding`: marca genérica, introducción y capacidades,
  con acceso principal y registro solo si el servidor lo habilita. `AuthLayout` conserva idioma y
  navegación; con sesión se muestra el tablero. La elección está en el fundamento visual.

- El código WhatsApp se pide y verifica desde la web aunque el chat esté en Manual. La invitación abre `/login` mediante orientación pública. El enlace de ingreso (`/ingresar`) se retiró el 2026-11-16 (B4). Nunca pedir autenticación por frases al chat.

- El backend define métodos disponibles y si el registro está abierto. Conservá intención ingreso/registro y la comprobación final del servidor.
- «Ingresar con» (ingreso y registro) es el segmentado con subrayado, `SegmentedControl appearance="public"`, con sus íconos y `aria-pressed`, no la pieza para elegir: es la excepción que el usuario pidió el 2026-11-24, al volverlo al diseño de antes ([la excepción](../../../docs/design/visual-baseline.md#ingresar-con-con-su-subrayado--2026-11-24)).
- Prepará OIDC en el SPA y validá `returnUrl`; el nombre de registro viaja en estado de ruta y solo se guarda al crear la cuenta.
- Canal, destino enmascarado y plazo de reenvío se conservan en el flujo de código. Los errores definitivos frenan verificar y reenviar.
- El país y teléfono se envían al backend sin normalizar. Los campos, código y errores comunes se reutilizan con perfil.

## Referencias

- [Flujos de acceso](../../../docs/architecture.md).
- [Reglas del backend](../../../../ArquitecturaBase/docs/features/identidad.md).
- [Oferta pública de medios](../../shared/api/loginMethods.ts).
