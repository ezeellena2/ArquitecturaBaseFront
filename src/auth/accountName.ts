import type { CurrentUser } from "./useCurrentUser";

type AccountIdentity = Pick<CurrentUser, "displayName" | "email" | "phoneNumber">;

/// Cómo se nombra la cuenta en la interfaz (el menú del usuario y la barra lateral): el nombre; si no tiene, el
/// correo; y si tampoco, el número. Una cuenta creada desde WhatsApp no tiene ni correo ni nombre. Vacío solo si
/// el servidor no mandó nada, que no debería pasar: una cuenta tiene siempre correo o número.
export function accountNameOf(user: AccountIdentity): string {
  return user.displayName ?? user.email ?? user.phoneNumber ?? "";
}

/// El renglón de abajo del nombre: con qué se identifica la cuenta, el correo o, sin correo, el número.
export function accountDetailOf(user: AccountIdentity): string | undefined {
  return user.email ?? user.phoneNumber ?? undefined;
}

/// La inicial del avatar: la primera letra o cifra, así un número ("+54 9…") no queda representado por el "+".
/// Un "?" si no hay de dónde sacarla.
export function initialOf(name: string): string {
  return /[\p{L}\p{N}]/u.exec(name)?.[0].toUpperCase() ?? "?";
}
