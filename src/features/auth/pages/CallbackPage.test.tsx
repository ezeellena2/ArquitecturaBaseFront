import { screen } from "@testing-library/react";
import { render } from "@testing-library/react";
import { RouterProvider, createMemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CallbackPage } from "./CallbackPage";
import { AppProviders } from "@/app/providers";

const retryStorageKey = "arquitecturabase.auth-callback-retry";

const authState: { isAuthenticated: boolean; isLoading: boolean; user: unknown; error: Error | undefined } = {
  isAuthenticated: false,
  isLoading: false,
  user: undefined,
  error: undefined,
};

vi.mock("react-oidc-context", async () => {
  const actual = await vi.importActual<typeof import("react-oidc-context")>("react-oidc-context");

  return { ...actual, useAuth: () => authState };
});

function renderAt(path: string) {
  const router = createMemoryRouter(
    [
      { path: "/login", element: <p>pantalla de ingreso</p> },
      { path: "/auth/callback", element: <CallbackPage /> },
    ],
    { initialEntries: [path] },
  );

  return render(
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>,
  );
}

describe("CallbackPage", () => {
  beforeEach(() => {
    globalThis.sessionStorage.removeItem(retryStorageKey);
    authState.isAuthenticated = false;
    authState.user = undefined;
    authState.error = undefined;
  });

  afterEach(() => {
    globalThis.sessionStorage.removeItem(retryStorageKey);
  });

  it("restarts the flow without a query the first time the exchange fails", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    authState.error = new Error("No matching state found in storage");

    renderAt("/auth/callback?code=abc&state=def&iss=https://localhost");

    expect(await screen.findByText("pantalla de ingreso")).toBeInTheDocument();
    expect(globalThis.sessionStorage.getItem(retryStorageKey)).toBe("1");
    // Solo el mensaje: nunca el objeto entero ni la URL (podrían llevar el code).
    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    expect(consoleErrorSpy).toHaveBeenCalledWith("No matching state found in storage");

    consoleErrorSpy.mockRestore();
  });

  it("shows the error banner instead of restarting again on a second failure", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    globalThis.sessionStorage.setItem(retryStorageKey, "1");
    authState.error = new Error("No matching state found in storage");

    renderAt("/auth/callback?code=abc&state=def&iss=https://localhost");

    expect(await screen.findByRole("alert")).toHaveTextContent("No pudimos iniciar tu sesión.");
    expect(screen.getByRole("link", { name: /volver a ingresar/i })).toBeInTheDocument();
    // No reinició el flujo de nuevo: seguimos en el callback, no en /login.
    expect(screen.queryByText("pantalla de ingreso")).not.toBeInTheDocument();

    consoleErrorSpy.mockRestore();
  });
});
