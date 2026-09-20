import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { RouterProvider, createMemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProtectedRoute } from "./ProtectedRoute";
import { AppProviders } from "@/app/providers";
import { render } from "@testing-library/react";
import { queryClient } from "@/shared/api/queryClient";
import { currentUser } from "@/test/mocks/handlers";
import { server } from "@/test/mocks/server";

const authState = { isAuthenticated: false, isLoading: false, user: undefined as unknown };

vi.mock("react-oidc-context", async () => {
  const actual = await vi.importActual<typeof import("react-oidc-context")>("react-oidc-context");

  return { ...actual, useAuth: () => authState };
});

function renderAt(path: string) {
  const router = createMemoryRouter(
    [
      { path: "/login", element: <p>pantalla de ingreso</p> },
      { path: "/sin-permiso", element: <p>pantalla de sin permiso</p> },
      {
        element: <ProtectedRoute />,
        children: [
          { path: "/tablero", element: <p>tablero</p> },
          {
            path: "/usuarios",
            element: <ProtectedRoute permission="users.manage" />,
            children: [{ index: true, element: <p>usuarios protegidos</p> }],
          },
        ],
      },
    ],
    { initialEntries: [path] },
  );

  return render(
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>,
  );
}

describe("ProtectedRoute", () => {
  // El queryClient de AppProviders es un singleton (staleTime propio): sin esto, la respuesta de /api/me de
  // un test queda cacheada y se filtra al siguiente, que pisó el handler con otra (mismo patrón que
  // Sidebar.test.tsx).
  beforeEach(() => {
    queryClient.clear();
  });

  it("sends anonymous visitors to the login screen", async () => {
    authState.isAuthenticated = false;

    renderAt("/tablero");

    expect(await screen.findByText("pantalla de ingreso")).toBeInTheDocument();
  });

  it("lets a signed in user through", async () => {
    authState.isAuthenticated = true;
    authState.user = { access_token: "t" };

    renderAt("/tablero");

    expect(await screen.findByText("tablero")).toBeInTheDocument();
  });

  it("shows a retry state instead of 'no permission' when the permission check fails", async () => {
    authState.isAuthenticated = true;
    authState.user = { access_token: "t" };
    server.use(
      http.get("/api/me", () =>
        HttpResponse.json(
          { status: 500, code: "General.Unexpected", detail: "Ocurrió un error inesperado.", traceId: "trace-456" },
          { status: 500 },
        ),
      ),
    );

    renderAt("/usuarios");

    expect(await screen.findByRole("button", { name: /reintentar/i })).toBeInTheDocument();
    expect(screen.getByText("Código para reportar: trace-456")).toBeInTheDocument();
    // Es un error recuperable, no una falta de permiso: nunca tiene que aparecer ese texto.
    expect(screen.queryByText(/no tenés permiso/i)).not.toBeInTheDocument();
  });

  it("retries the permission check when the retry button is clicked", async () => {
    authState.isAuthenticated = true;
    authState.user = { access_token: "t" };
    let requestCount = 0;
    server.use(
      http.get("/api/me", () => {
        requestCount += 1;

        if (requestCount === 1) {
          return HttpResponse.json(
            { status: 500, code: "General.Unexpected", detail: "Ocurrió un error inesperado.", traceId: "trace-456" },
            { status: 500 },
          );
        }

        return HttpResponse.json({ ...currentUser, permissions: ["users.manage"] });
      }),
    );

    renderAt("/usuarios");

    await userEvent.click(await screen.findByRole("button", { name: /reintentar/i }));

    expect(await screen.findByText("usuarios protegidos")).toBeInTheDocument();
  });
});
