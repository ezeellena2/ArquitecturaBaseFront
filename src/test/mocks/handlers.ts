import { http, HttpResponse } from "msw";
import type { CurrentUser } from "@/auth/useCurrentUser";

/// Perfil que devuelve /api/me por defecto. Los tests que necesitan otro lo pisan con server.use(...).
///
/// Va tipado como `CurrentUser` a propósito: así un campo nuevo del perfil rompe acá y no en silencio, y los
/// tests que lo copian con `{ ...currentUser, … }` heredan los tipos de verdad (`displayName` puede ser null).
export const currentUser: CurrentUser = {
  id: "0199a0c0-0000-7000-8000-000000000000",
  email: "ana@example.com",
  displayName: "Ana",
  culture: "es",
  timeZoneId: "America/Argentina/Buenos_Aires",
  lastLoginAtUtc: null,
  roles: ["User"],
  permissions: ["users.read"],
};

/// Handlers por defecto. Cada test agrega los suyos con server.use(...).
export const handlers = [http.get("/api/me", () => HttpResponse.json(currentUser))];
