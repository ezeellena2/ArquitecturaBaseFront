import { screen } from "@testing-library/react";
import { RouterProvider, createMemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";
import { ProtectedRoute } from "./ProtectedRoute";
import { AppProviders } from "@/app/providers";
import { render } from "@testing-library/react";

const authState = { isAuthenticated: false, isLoading: false, user: undefined as unknown };

vi.mock("react-oidc-context", async () => {
  const actual = await vi.importActual<typeof import("react-oidc-context")>("react-oidc-context");

  return { ...actual, useAuth: () => authState };
});

function renderAt(path: string) {
  const router = createMemoryRouter(
    [
      { path: "/login", element: <p>pantalla de ingreso</p> },
      {
        element: <ProtectedRoute />,
        children: [
          { path: "/tablero", element: <p>tablero</p> },
          { path: "/usuarios", element: <ProtectedRoute permission="users.manage" />, children: [] },
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
});
