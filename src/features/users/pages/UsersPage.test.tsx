import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderRouteWithProviders } from "@/test/utils/renderWithProviders";
import { queryClient } from "@/shared/api/queryClient";
import { server } from "@/test/mocks/server";

vi.mock("react-oidc-context", async () => {
  const actual = await vi.importActual<typeof import("react-oidc-context")>("react-oidc-context");

  return { ...actual, useAuth: () => ({ isAuthenticated: true, isLoading: false, user: { access_token: "t" } }) };
});

const page = {
  items: [
    { id: "1", email: "ana@example.com", displayName: "Ana", isActive: true, createdAtUtc: "2026-09-18T12:00:00Z" },
    { id: "2", email: "beto@example.com", displayName: null, isActive: false, createdAtUtc: "2026-09-18T13:00:00Z" },
  ],
  page: 1,
  pageSize: 20,
  totalCount: 2,
  totalPages: 1,
  hasPrevious: false,
  hasNext: false,
};

describe("UsersPage", () => {
  // AppProviders usa el queryClient de la app (un singleton, con staleTime). Sin esto, la respuesta de
  // /api/users de un test queda cacheada y se filtra al siguiente, que pisó el handler con otra respuesta
  // (mismo patrón que Sidebar.test.tsx).
  beforeEach(() => {
    queryClient.clear();
  });

  it("shows the users of the first page", async () => {
    server.use(http.get("/api/users", () => HttpResponse.json(page)));

    renderRouteWithProviders("/usuarios");

    // El usuario de sesión por defecto (test/mocks/handlers.ts) también se llama Ana <ana@example.com> y su
    // correo aparece siempre al pie del sidebar: hay que acotar la búsqueda a la tabla para no toparse con
    // esa otra coincidencia (y de paso, esperar a que la tabla haya montado, no cualquier texto suelto).
    const table = await screen.findByRole("table");
    expect(within(table).getByText("ana@example.com")).toBeInTheDocument();
    expect(within(table).getByText("beto@example.com")).toBeInTheDocument();
  });

  it("sends the search to the backend and keeps it in the URL", async () => {
    const requests: string[] = [];
    server.use(
      http.get("/api/users", ({ request }) => {
        requests.push(new URL(request.url).search);
        return HttpResponse.json(page);
      }),
    );

    renderRouteWithProviders("/usuarios");
    await screen.findByRole("table");
    await userEvent.type(screen.getByRole("searchbox"), "ana");

    await waitFor(() => expect(requests.at(-1)).toContain("search=ana"));
  });

  it("shows the message when the search returns nothing", async () => {
    server.use(http.get("/api/users", () => HttpResponse.json({ ...page, items: [], totalCount: 0, totalPages: 0 })));

    renderRouteWithProviders("/usuarios");

    expect(await screen.findByRole("heading", { name: /no encontramos usuarios/i })).toBeInTheDocument();
  });

  it("shows the forbidden page when the backend answers 403", async () => {
    server.use(
      http.get("/api/users", () =>
        HttpResponse.json({ status: 403, code: "Http.Forbidden", detail: "No tenés permiso." }, { status: 403 }),
      ),
    );

    renderRouteWithProviders("/usuarios");

    // La sección 6.1 del spec pide la pantalla de "sin permiso", no un error dentro del listado.
    expect(await screen.findByRole("heading", { name: /no tenés permiso/i })).toBeInTheDocument();
  });

  it("shows the error state with the traceId when the backend fails", async () => {
    server.use(
      http.get("/api/users", () =>
        HttpResponse.json(
          { status: 500, code: "General.Unexpected", detail: "Ocurrió un error inesperado.", traceId: "trace-123" },
          { status: 500 },
        ),
      ),
    );

    renderRouteWithProviders("/usuarios");

    expect(await screen.findByRole("heading", { name: /ocurrió un error inesperado/i })).toBeInTheDocument();
    // El texto exacto: el toast del queryClient global también menciona el traceId (sección 6.1 del spec),
    // así que no alcanza con buscar "trace-123" a secas.
    expect(screen.getByText("Código para reportar: trace-123")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /reintentar/i })).toBeInTheDocument();
  });
});
