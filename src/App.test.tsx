import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/utils/renderWithProviders";
import App from "./App";

// "/" vive atrás de ProtectedRoute (sección 7.3): desde la Tarea 11, sin sesión manda de verdad a /login, que
// no muestra nada mientras arranca el ingreso con OIDC (sección 5.2). Para esta prueba de humo del shell
// alcanza con simular una sesión ya iniciada, como hace ProtectedRoute.test.tsx.
vi.mock("react-oidc-context", async () => {
  const actual = await vi.importActual<typeof import("react-oidc-context")>("react-oidc-context");

  return { ...actual, useAuth: () => ({ isAuthenticated: true, isLoading: false, user: { access_token: "t" } }) };
});

describe("App", () => {
  it("renders the application shell", async () => {
    renderWithProviders(<App />);

    expect(await screen.findByRole("heading", { level: 1 })).toBeInTheDocument();
  });
});
