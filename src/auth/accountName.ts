import type { CurrentUser } from "./useCurrentUser";

type AccountIdentity = Pick<CurrentUser, "displayName" | "email" | "formattedPhoneNumber">;

/// Cómo se nombra la cuenta en la interfaz (el menú del usuario y la barra lateral): el nombre; si no tiene, el
/// correo; y si tampoco, el número. Una cuenta creada desde WhatsApp no tiene ni correo ni nombre. Vacío solo si
/// el servidor no mandó nada, que no debería pasar: una cuenta tiene siempre correo o número.
///
/// El número va siempre formateado ("+54 9 11 2345-6789"), nunca en E.164: lo agrupa el servidor.
export function accountNameOf(user: AccountIdentity): string {
  return user.displayName ?? user.email ?? user.formattedPhoneNumber ?? "";
}

/// El renglón de abajo del nombre: con qué se identifica la cuenta, el correo o, sin correo, el número formateado.
/// Sin nombre no hay renglón de abajo: el del nombre ya muestra ese mismo correo o número, y repetirlo abajo es
/// lo que hacía que una cuenta creada desde WhatsApp mostrara su número dos veces, una debajo de la otra.
export function accountDetailOf(user: AccountIdentity): string | undefined {
  if (user.displayName === null) {
    return undefined;
  }

  return user.email ?? user.formattedPhoneNumber ?? undefined;
}

/// La inicial del avatar: la primera letra o cifra, así un número ("+54 9…") no queda representado por el "+".
/// Un "?" si no hay de dónde sacarla.
export function initialOf(name: string): string {
  return /[\p{L}\p{N}]/u.exec(name)?.[0].toUpperCase() ?? "?";
}
