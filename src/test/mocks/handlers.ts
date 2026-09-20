import { http, HttpResponse } from "msw";

/// Perfil que devuelve /api/me por defecto. Los tests que necesitan otro lo pisan con server.use(...).
export const currentUser = {
  id: "0199a0c0-0000-7000-8000-000000000000",
  email: "ana@example.com",
  displayName: "Ana",
  culture: "es",
  timeZoneId: "America/Argentina/Buenos_Aires",
  roles: ["User"],
  permissions: [] as string[],
};

/// Handlers por defecto. Cada test agrega los suyos con server.use(...).
export const handlers = [http.get("/api/me", () => HttpResponse.json(currentUser))];
