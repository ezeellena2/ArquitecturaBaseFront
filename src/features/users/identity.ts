import type { UserListItem } from "./api/users";

type Identity = Pick<UserListItem, "email" | "formattedPhoneNumber" | "displayName">;

/// Cómo se nombra una cuenta en una acción ("Editar a …", "Eliminar a …"): el correo, o el número formateado si no
/// tiene correo (tablero "WhatsApp · Usuarios: alta con teléfono", punto 1). El nombre queda de último recurso, para
/// la cuenta que se quedó sin ninguno de los dos (se le desvinculó el WhatsApp y no tenía correo).
export function userIdentifier(user: Identity): string {
  return user.email ?? user.formattedPhoneNumber ?? user.displayName ?? "—";
}

/// Cómo se nombra a la persona en una frase ("¿Desvincular el WhatsApp de Juan Gómez?"): por su nombre, y si no tiene,
/// como en las acciones.
export function userName(user: Identity): string {
  return user.displayName ?? userIdentifier(user);
}
