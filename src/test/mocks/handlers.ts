import { http, HttpResponse } from "msw";

/// Handlers por defecto. Cada test agrega los suyos con server.use(...).
export const handlers = [
  http.get("/api/me", () => new HttpResponse(null, { status: 401 })),
];
