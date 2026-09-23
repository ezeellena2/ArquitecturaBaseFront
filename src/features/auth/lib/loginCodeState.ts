/// El estado de la ruta con el que `LoginPage` manda a `/login/codigo` después de pedir el código. Viaja en el
/// estado y no en la URL: el correo o el número no quedan en el historial ni en un enlace copiado.
export type LoginCodeState =
  | { readonly channel: "email"; readonly email: string; readonly resendAfterSeconds: number }
  | {
      readonly channel: "whatsapp";
      /// En formato internacional, tal como lo devolvió el servidor: es el que se verifica y se reenvía.
      readonly phone: string;
      readonly maskedPhone: string;
      readonly resendAfterSeconds: number;
    };

/// A dónde se mandó el código.
export type CodeDestination =
  | { readonly channel: "email"; readonly email: string }
  | { readonly channel: "whatsapp"; readonly phone: string; readonly maskedPhone: string };

/// El estado con el que se vuelve a `/login` desde la pantalla del código ("Usar otro número"), para que abra con
/// el mismo medio elegido. `returnTo` es el que arma `ProtectedRoute` cuando manda para acá sin sesión.
export interface LoginState {
  readonly channel?: "email" | "whatsapp";
  readonly returnTo?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isFilled(value: unknown): value is string {
  return typeof value === "string" && value !== "";
}

/// Lee el destino del estado de la ruta. Sin `channel` es el correo: es la forma que tenía el estado antes de
/// WhatsApp, así nada de lo que ya funcionaba se rompe. Undefined si falta el dato (se entró a `/login/codigo`
/// sin pasar por `/login`): la pantalla vuelve a `/login`.
export function codeDestinationOf(state: unknown): CodeDestination | undefined {
  if (!isRecord(state)) {
    return undefined;
  }

  if (state.channel === "whatsapp") {
    return isFilled(state.phone) && isFilled(state.maskedPhone)
      ? { channel: "whatsapp", phone: state.phone, maskedPhone: state.maskedPhone }
      : undefined;
  }

  return isFilled(state.email) ? { channel: "email", email: state.email } : undefined;
}

export function resendAfterSecondsOf(state: unknown): number {
  return isRecord(state) && typeof state.resendAfterSeconds === "number" ? state.resendAfterSeconds : 0;
}

/// El medio con el que abre `/login`: WhatsApp solo si se volvió desde un código por WhatsApp.
export function loginChannelOf(state: unknown): "email" | "whatsapp" {
  return isRecord(state) && state.channel === "whatsapp" ? "whatsapp" : "email";
}
